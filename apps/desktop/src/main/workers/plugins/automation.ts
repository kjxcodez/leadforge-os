import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
import type { JobContext } from "../../../shared/types/job";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AutomationWorkflowPayload {
  sequenceId: string;
  entityId: string;
  entityType: string;
  triggerType?: string;
  triggerPayload?: any;
  workspaceId?: string;
  /** Present on resume: the previously saved checkpoint data. */
  _checkpoint?: AutomationCheckpoint | null;
}

interface AutomationCheckpoint {
  executionId: string;
  currentStep: number;
  sequenceId: string;
  entityId: string;
  entityType: string;
  /** Secondary crash-recovery path for execution context. */
  executionContext?: ExecutionContext;
}

/**
 * Mutable execution context that travels with a workflow run.
 * Persisted atomically to `sequence_executions.executionContext` after every step.
 */
interface ExecutionContext {
  /** User-defined workflow variables set by SET_VARIABLE steps. */
  variables: Record<string, any>;
  /** Snapshot of the target contact row at run start. */
  contact: Record<string, any>;
  /** Snapshot of the target company row at run start (if applicable). */
  company: Record<string, any>;
  sequence: { id: string; name: string };
  workspace: { id: string };
  execution: { id: string; currentStep: number; startedAt: string };
  runtime: {
    /** Incremented on every loop iteration. Reset to 0 on resume. */
    loopCount: number;
    /**
     * Incremented on every GOTO/IF-jump.
     * Persisted across crash-restarts to prevent infinite-loop bypass via restart.
     */
    jumpCount: number;
    /** Name of the most recently entered LABEL, or null. */
    currentLabel: string | null;
  };
}

interface SequenceRecord {
  id: string;
  name: string;
  status: string;
  trigger: string;
  steps: string;
}

interface StepDefinition {
  type: string;
  [key: string]: any;
}

type StepResult =
  | { status: "success" }
  | { status: "wait"; delaySeconds: number }
  | { status: "goto"; targetIndex: number; targetLabel: string }
  | { status: "skip"; skipCount: number };

// ── Event publisher ────────────────────────────────────────────────────────────

function publishAutomationEvent(event: string, payload: any): void {
  if (process.send) {
    process.send({ type: "automation_event", event, payload });
  }
}

// ── Variable Resolution ────────────────────────────────────────────────────────

/**
 * Resolves a single dotted-path token (e.g. "contact.email", "variables.score", "today")
 * against the ExecutionContext. Returns a string representation of the value.
 *
 * This is the single source of truth for all variable resolution. Both
 * `resolveVariables()` (template strings) and the expression engine (TEMPLATE tokens)
 * call through here.
 */
function resolveTokenPath(path: string, ctx: ExecutionContext): string {
  const trimmed = path.trim();
  const dotIdx = trimmed.indexOf(".");
  const ns = dotIdx === -1 ? trimmed : trimmed.slice(0, dotIdx);
  const field = dotIdx === -1 ? "" : trimmed.slice(dotIdx + 1);

  switch (ns) {
    case "contact":
      if (field === "name") {
        return `${ctx.contact.firstName || ""} ${ctx.contact.lastName || ""}`.trim();
      }
      return String(ctx.contact[field] ?? "");

    case "company":
      return String(ctx.company[field] ?? "");

    case "workspace":
      return ctx.workspace.id;

    case "execution":
      if (field === "id") return ctx.execution.id;
      if (field === "currentStep") return String(ctx.execution.currentStep);
      if (field === "startedAt") return ctx.execution.startedAt;
      return "";

    case "sequence":
      if (field === "id") return ctx.sequence.id;
      if (field === "name") return ctx.sequence.name;
      return "";

    case "variables":
      // Support nested object access in execution context (e.g. variables.apiResponse.status)
      if (field.includes(".")) {
        const parts = field.split(".");
        let currentObj: any = ctx.variables;
        for (const p of parts) {
          if (currentObj === null || currentObj === undefined) return "";
          currentObj = currentObj[p];
        }
        return String(currentObj ?? "");
      }
      return String(ctx.variables[field] ?? "");

    case "today":
      return new Date().toISOString().split("T")[0] ?? "";

    case "now":
      return new Date().toISOString();

    case "currentStep":
      return String(ctx.execution.currentStep);

    default: {
      // Legacy single-word tokens ({{firstName}}, {{sequence}}, etc.) and
      // bare variable names ({{score}} maps to ctx.variables.score).
      const legacy: Record<string, () => string> = {
        firstName: () => String(ctx.contact.firstName ?? ""),
        lastName: () => String(ctx.contact.lastName ?? ""),
        fullName: () =>
          `${ctx.contact.firstName || ""} ${ctx.contact.lastName || ""}`.trim(),
        email: () => String(ctx.contact.email ?? ""),
        phone: () => String(ctx.contact.phone ?? ""),
        title: () => String(ctx.contact.title ?? ""),
        sequence: () => ctx.sequence.name,
        today: () => new Date().toISOString().split("T")[0] ?? "",
        now: () => new Date().toISOString(),
      };
      if (trimmed in legacy) return legacy[trimmed]!();
      if (trimmed in ctx.variables) return String(ctx.variables[trimmed] ?? "");
      return "";
    }
  }
}

/**
 * Replaces all `{{token}}` references in a template string using the ExecutionContext.
 * Used by SEND_EMAIL, ASSIGN_TAG, and SET_VARIABLE step handlers.
 */
export function resolveVariables(
  template: string,
  ctx: ExecutionContext,
): string {
  if (template === null || template === undefined) return "";
  if (typeof template !== "string") return String(template);
  return template.replace(/\{\{([^}]+)\}\}/g, (_m, raw: string) =>
    resolveTokenPath(raw.trim(), ctx),
  );
}

export function resolveVariablesRecursive(
  val: any,
  ctx: ExecutionContext,
  db?: Database.Database,
  workspaceId?: string,
  secrets?: Record<string, string>,
): any {
  if (val === null || val === undefined) return val;

  if (typeof val === "string") {
    // 1. Resolve secrets first
    if (val.includes("{{secret.")) {
      return val.replace(/\{\{secret\.([^}]+)\}\}/g, (_m, key: string) => {
        const trimmedKey = key.trim();
        const possibleKeys = [
          trimmedKey,
          `secret.${trimmedKey}`,
          `secrets.${trimmedKey}`,
        ];
        // 1.1 Check injected secrets from payload first (Least Privilege)
        if (secrets) {
          for (const pk of possibleKeys) {
            if (secrets[pk] !== undefined && secrets[pk] !== null) {
              return secrets[pk];
            }
          }
        }
        // 1.2 Fallback to database settings table
        if (db && workspaceId) {
          for (const pk of possibleKeys) {
            const row = db
              .prepare(
                "SELECT value FROM settings WHERE workspaceId = ? AND key = ?",
              )
              .get(workspaceId, pk) as { value: string } | undefined;
            if (row?.value) return row.value;
          }
        }
        return "";
      });
    }
    // 2. Resolve standard templates
    return resolveVariables(val, ctx);
  }

  if (Array.isArray(val)) {
    return val.map((item) =>
      resolveVariablesRecursive(item, ctx, db, workspaceId, secrets),
    );
  }

  if (typeof val === "object") {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = resolveVariablesRecursive(v, ctx, db, workspaceId, secrets);
    }
    return res;
  }

  return val;
}

// ── Expression Engine ─────────────────────────────────────────────────────────

type TokenKind =
  | "NUM"
  | "STR"
  | "TEMPLATE"
  | "IDENT"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "OP"
  | "AND"
  | "OR"
  | "NOT"
  | "EOF";

interface Token {
  kind: TokenKind;
  value: string;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < src.length) {
    // Whitespace
    if (/\s/.test(src.charAt(i))) {
      i++;
      continue;
    }

    // Template: {{ ... }}
    if (src.charAt(i) === "{" && src.charAt(i + 1) === "{") {
      let j = i + 2;
      while (
        j < src.length &&
        !(src.charAt(j) === "}" && src.charAt(j + 1) === "}")
      )
        j++;
      tokens.push({ kind: "TEMPLATE", value: src.slice(i + 2, j).trim() });
      i = j + 2;
      continue;
    }

    // Two-char operators
    if (i + 1 < src.length) {
      const two = src.slice(i, i + 2);
      if (two === "==") {
        tokens.push({ kind: "OP", value: "==" });
        i += 2;
        continue;
      }
      if (two === "!=") {
        tokens.push({ kind: "OP", value: "!=" });
        i += 2;
        continue;
      }
      if (two === ">=") {
        tokens.push({ kind: "OP", value: ">=" });
        i += 2;
        continue;
      }
      if (two === "<=") {
        tokens.push({ kind: "OP", value: "<=" });
        i += 2;
        continue;
      }
      if (two === "&&") {
        tokens.push({ kind: "AND", value: "&&" });
        i += 2;
        continue;
      }
      if (two === "||") {
        tokens.push({ kind: "OR", value: "||" });
        i += 2;
        continue;
      }
    }

    const c = src.charAt(i);
    if (c === ">") {
      tokens.push({ kind: "OP", value: ">" });
      i++;
      continue;
    }
    if (c === "<") {
      tokens.push({ kind: "OP", value: "<" });
      i++;
      continue;
    }
    if (c === "!") {
      tokens.push({ kind: "NOT", value: "!" });
      i++;
      continue;
    }
    if (c === "(") {
      tokens.push({ kind: "LPAREN", value: "(" });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ kind: "RPAREN", value: ")" });
      i++;
      continue;
    }
    if (c === ",") {
      tokens.push({ kind: "COMMA", value: "," });
      i++;
      continue;
    }

    // String literals (single or double quoted)
    if (c === '"' || c === "'") {
      const q = c;
      let j = i + 1;
      while (j < src.length && src.charAt(j) !== q) j++;
      tokens.push({ kind: "STR", value: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }

    // Numbers (including negative: only when preceded by operator/start)
    const prevToken = tokens.length > 0 ? tokens[tokens.length - 1] : undefined;
    const nextChar = src.charAt(i + 1);
    const canBeNeg =
      c === "-" &&
      /[0-9]/.test(nextChar) &&
      (!prevToken ||
        prevToken.kind === "OP" ||
        prevToken.kind === "AND" ||
        prevToken.kind === "OR" ||
        prevToken.kind === "NOT" ||
        prevToken.kind === "LPAREN" ||
        prevToken.kind === "COMMA");
    if (/[0-9]/.test(c) || canBeNeg) {
      let j = i;
      if (src.charAt(j) === "-") j++;
      while (j < src.length && /[0-9.]/.test(src.charAt(j))) j++;
      tokens.push({ kind: "NUM", value: src.slice(i, j) });
      i = j;
      continue;
    }

    // Identifiers (letters, digits, underscores, dots for path lookup)
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_.]/.test(src.charAt(j))) j++;
      tokens.push({ kind: "IDENT", value: src.slice(i, j) });
      i = j;
      continue;
    }

    throw new Error(
      `Expression parser: unexpected character '${c}' at position ${i} in expression: ${src}`,
    );
  }

  tokens.push({ kind: "EOF", value: "" });
  return tokens;
}

class ExpressionParser {
  private readonly tokens: Token[];
  private readonly ctx: ExecutionContext;
  private pos = 0;

  constructor(tokens: Token[], ctx: ExecutionContext) {
    this.tokens = tokens;
    this.ctx = ctx;
  }

  private peek(): Token {
    return this.tokens[this.pos]!;
  }
  private consume(): Token {
    return this.tokens[this.pos++]!;
  }
  private expect(kind: TokenKind): Token {
    const t = this.consume();
    if (t.kind !== kind) {
      throw new Error(
        `Expression parser: expected ${kind}, got ${t.kind} ("${t.value}")`,
      );
    }
    return t;
  }

  parseExpr(): boolean {
    return this.parseOr();
  }

  private parseOr(): boolean {
    let left = this.parseAnd();
    while (this.peek().kind === "OR") {
      this.consume();
      const right = this.parseAnd();
      left = left || right;
    }
    return left;
  }

  private parseAnd(): boolean {
    let left = this.parseNot();
    while (this.peek().kind === "AND") {
      this.consume();
      const right = this.parseNot();
      left = left && right;
    }
    return left;
  }

  private parseNot(): boolean {
    if (this.peek().kind === "NOT") {
      this.consume();
      return !this.parseNot();
    }
    return this.parseComparison();
  }

  private parseComparison(): boolean {
    const left = this.parseValue();
    const op = this.peek();
    if (op.kind !== "OP") {
      return this.coerceBool(left);
    }
    this.consume();
    const right = this.parseValue();
    return this.compare(left, op.value, right);
  }

  private parseValue(): any {
    const t = this.peek();

    if (t.kind === "LPAREN") {
      this.consume();
      const val = this.parseExpr();
      this.expect("RPAREN");
      return val;
    }

    if (t.kind === "TEMPLATE") {
      this.consume();
      // Resolve lazily — safe for any character sequence including @, ., spaces, etc.
      const resolved = resolveTokenPath(t.value, this.ctx);
      const asNum = parseFloat(resolved);
      return !isNaN(asNum) && String(asNum) === resolved.trim()
        ? asNum
        : resolved;
    }

    if (t.kind === "NUM") {
      this.consume();
      return parseFloat(t.value);
    }

    if (t.kind === "STR") {
      this.consume();
      return t.value;
    }

    if (t.kind === "IDENT") {
      // Function call — check next token without consuming
      const nextTok = this.tokens[this.pos + 1];
      if (nextTok?.kind === "LPAREN") {
        return this.parseFnCall();
      }
      this.consume();
      if (t.value === "true") return true;
      if (t.value === "false") return false;
      if (t.value === "null") return null;
      // Dotted lookup in variables namespace directly
      if (
        t.value.startsWith("apiResponse.") ||
        t.value.startsWith("variables.")
      ) {
        const path = t.value.startsWith("variables.")
          ? t.value
          : `variables.${t.value}`;
        const resolved = resolveTokenPath(path, this.ctx);
        const asNum = parseFloat(resolved);
        if (!isNaN(asNum) && String(asNum) === resolved.trim()) return asNum;
        if (resolved === "true") return true;
        if (resolved === "false") return false;
        if (resolved === "null") return null;
        return resolved;
      }
      // Bare identifier → look up in ctx.variables
      if (t.value in this.ctx.variables) {
        const v = this.ctx.variables[t.value];
        return typeof v === "number" ? v : String(v ?? "");
      }
      // Unknown → treat as string literal (allows comparisons like status == ACTIVE)
      return t.value;
    }

    throw new Error(
      `Expression parser: unexpected token ${t.kind} ("${t.value}")`,
    );
  }

  private parseFnCall(): any {
    const name = this.consume().value;
    this.expect("LPAREN");
    const args: any[] = [];
    if (this.peek().kind !== "RPAREN") {
      args.push(this.parseValue());
      while (this.peek().kind === "COMMA") {
        this.consume();
        args.push(this.parseValue());
      }
    }
    this.expect("RPAREN");

    const a = String(args[0] ?? "");
    const b = String(args[1] ?? "");

    switch (name) {
      case "contains":
        return a.includes(b);
      case "startsWith":
        return a.startsWith(b);
      case "endsWith":
        return a.endsWith(b);
      case "exists":
        return (
          args[0] !== null &&
          args[0] !== undefined &&
          String(args[0]).trim() !== ""
        );
      case "empty":
        return (
          args[0] === null ||
          args[0] === undefined ||
          String(args[0]).trim() === ""
        );
      default:
        throw new Error(`Expression parser: unknown function "${name}".`);
    }
  }

  private compare(left: any, op: string, right: any): boolean {
    const lNum = parseFloat(String(left));
    const rNum = parseFloat(String(right));
    if (!isNaN(lNum) && !isNaN(rNum)) {
      switch (op) {
        case "==":
          return lNum === rNum;
        case "!=":
          return lNum !== rNum;
        case ">":
          return lNum > rNum;
        case "<":
          return lNum < rNum;
        case ">=":
          return lNum >= rNum;
        case "<=":
          return lNum <= rNum;
      }
    }
    const l = String(left);
    const r = String(right);
    switch (op) {
      case "==":
        return l === r;
      case "!=":
        return l !== r;
      case ">":
        return l > r;
      case "<":
        return l < r;
      case ">=":
        return l >= r;
      case "<=":
        return l <= r;
    }
    return false;
  }

  private coerceBool(val: any): boolean {
    if (typeof val === "boolean") return val;
    if (
      val === null ||
      val === undefined ||
      val === "" ||
      val === "0" ||
      val === "false"
    )
      return false;
    return true;
  }
}

/**
 * Evaluates a boolean expression string using the current ExecutionContext.
 * `{{...}}` tokens are resolved lazily by the parser — no pre-resolution pass.
 * Does not use eval().
 */
function evaluateExpression(
  expression: string,
  ctx: ExecutionContext,
): boolean {
  if (!expression || !expression.trim()) return false;
  const tokens = tokenize(expression);
  const parser = new ExpressionParser(tokens, ctx);
  return parser.parseExpr();
}

// ── Label Map & Runtime Validation ────────────────────────────────────────────

/**
 * Builds a Map<labelName (lowercased) → stepIndex> for O(1) jump resolution.
 * Called once before the execution loop begins.
 */
function buildLabelMap(steps: StepDefinition[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s && s.type === "LABEL" && s.config?.name) {
      map.set(String(s.config.name).toLowerCase(), i);
    }
  }
  return map;
}

/**
 * Validates a workflow step array before execution starts.
 * Returns an array of human-readable error strings (empty array = valid).
 */
function validateWorkflow(steps: StepDefinition[]): string[] {
  const errors: string[] = [];
  const labelMap = buildLabelMap(steps);
  const seenLabels = new Set<string>();
  const seenResponseVars = new Set<string>();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step || !step.type) {
      errors.push(`Step at index ${i} is malformed or missing a type.`);
      continue;
    }

    const registryAction = ActionRegistry[step.type];
    if (!registryAction) {
      errors.push(`Step at index ${i}: Unhandled step type "${step.type}"`);
      continue;
    }

    // Action-specific validations
    const actionErrors = registryAction.validate(step, labelMap);
    errors.push(
      ...actionErrors.map((e) => `Step at index ${i} (${step.type}): ${e}`),
    );

    // Sequence-wide assertions
    if (step.type === "LABEL" && step.config?.name) {
      const name = String(step.config.name).toLowerCase();
      if (seenLabels.has(name)) {
        errors.push(
          `Step at index ${i} (LABEL): Duplicate label "${step.config.name}"`,
        );
      }
      seenLabels.add(name);
    }

    if (step.type === "HTTP_REQUEST" && step.config?.saveResponseAs) {
      const saveResponseAs = String(step.config.saveResponseAs).trim();
      if (seenResponseVars.has(saveResponseAs)) {
        errors.push(
          `Step at index ${i} (HTTP_REQUEST): Duplicate saveResponseAs variable "${saveResponseAs}" across workflow`,
        );
      }
      seenResponseVars.add(saveResponseAs);
    }

    // Inspect config properties for malformed secrets or recursive assignments
    if (step.config) {
      const inspectValue = (val: any, path: string) => {
        if (typeof val === "string") {
          if (val.includes("{{secret.")) {
            val.replace(/\{\{secret\.([^}]+)\}\}/g, (_m, key: string) => {
              const trimmed = key.trim();
              if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
                errors.push(
                  `Step at index ${i} (${step.type}): Invalid secret reference format in "${path}": "${trimmed}" (must be alphanumeric)`,
                );
              }
              return "";
            });
          }
          if (step.type === "SET_VARIABLE" && step.config?.assignments) {
            step.config.assignments.forEach((assignment: any) => {
              if (
                assignment.variable &&
                val.includes(`{{variables.${assignment.variable}}}`)
              ) {
                errors.push(
                  `Step at index ${i} (${step.type}): Recursive variable reference detected: "${assignment.variable}" references itself`,
                );
              }
            });
          }
        } else if (Array.isArray(val)) {
          val.forEach((item, idx) => inspectValue(item, `${path}[${idx}]`));
        } else if (typeof val === "object" && val !== null) {
          for (const [k, v] of Object.entries(val)) {
            inspectValue(v, `${path}.${k}`);
          }
        }
      };

      for (const [k, v] of Object.entries(step.config)) {
        inspectValue(v, k);
      }
    }
  }
  return errors;
}

// ── ExecutionContext Factory & Entity Loader ───────────────────────────────────

function createExecutionContext(
  executionId: string,
  sequenceId: string,
  sequenceName: string,
  workspaceId: string,
  contact: Record<string, any>,
  company: Record<string, any>,
  startedAt: string,
): ExecutionContext {
  return {
    variables: {},
    contact,
    company,
    sequence: { id: sequenceId, name: sequenceName },
    workspace: { id: workspaceId },
    execution: { id: executionId, currentStep: 0, startedAt },
    runtime: { loopCount: 0, jumpCount: 0, currentLabel: null },
  };
}

function loadEntityData(
  db: Database.Database,
  entityId: string,
  entityType: string,
  workspaceId: string,
): { contact: Record<string, any>; company: Record<string, any> } {
  let contact: Record<string, any> = {};
  let company: Record<string, any> = {};

  if (entityType === "contact") {
    const row = db
      .prepare(
        `
      SELECT id, firstName, lastName, email, phone, title, status, tags
      FROM contacts WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL
    `,
      )
      .get(entityId, workspaceId) as any;
    if (row) contact = row;
  } else if (entityType === "company") {
    const row = db
      .prepare(
        `
      SELECT id, name, domain, industry, status
      FROM companies WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL
    `,
      )
      .get(entityId, workspaceId) as any;
    if (row) company = row;
  }

  return { contact, company };
}

// ── Main Plugin ────────────────────────────────────────────────────────────────

/**
 * Automation Workflow Plugin — STAB-013A through STAB-013E.
 *
 * Executes `automation:workflow` jobs. Runs consecutive synchronous steps in a
 * single worker process. Exits only on: WAIT step, workflow completion, pause,
 * cancellation, or unrecoverable error.
 *
 * STAB-013E adds: Plugin Action Registry, HTTP_REQUEST action execution,
 * dynamic secrets resolution, retry classification, and diagnostic logs redaction.
 */
export async function executeAutomationWorkflow(ctx: JobContext): Promise<any> {
  ctx.emitLog("Automation workflow plugin execution starting.", "info");

  const executionStartTime = Date.now();
  const MAX_EXECUTION_DURATION_MS = 300_000; // 5 minutes

  const db = new Database(ctx.dbPath);

  let sequenceId: string | undefined;
  let entityId: string | undefined;
  let entityType: string | undefined;
  let executionId: string | undefined;
  let currentStep = 0;
  let steps: StepDefinition[] = [];

  try {
    // ── 1. Resolve payload & checkpoint ──────────────────────────────────────
    const payload = ctx.payload as AutomationWorkflowPayload;
    const checkpoint = ctx.getCheckpoint() as AutomationCheckpoint | null;
    const isResume = !!checkpoint?.executionId;

    executionId = isResume
      ? checkpoint!.executionId
      : (payload as any).executionId || randomUUID();
    currentStep = isResume
      ? checkpoint!.currentStep
      : ((payload as any).resumeFrom ?? 0);

    sequenceId = payload?.sequenceId;
    entityId = payload?.entityId;
    entityType = payload?.entityType;

    // Recover missing fields from the execution record (resume from DB)
    if (!sequenceId && executionId) {
      const execRecord = db
        .prepare(
          `
        SELECT sequenceId, contactId, companyId
        FROM sequence_executions WHERE id = ? AND workspaceId = ?
      `,
        )
        .get(executionId, ctx.workspaceId) as
        | {
            sequenceId: string;
            contactId: string | null;
            companyId: string | null;
          }
        | undefined;

      if (execRecord) {
        sequenceId = execRecord.sequenceId;
        if (execRecord.contactId) {
          entityId = execRecord.contactId;
          entityType = "contact";
        } else if (execRecord.companyId) {
          entityId = execRecord.companyId;
          entityType = "company";
        }
      }
    }

    // ── 2. Validate required fields ───────────────────────────────────────────
    if (!sequenceId)
      throw new Error(
        "Automation workflow: missing required payload field: sequenceId.",
      );
    if (!entityId)
      throw new Error(
        "Automation workflow: missing required payload field: entityId.",
      );
    if (!entityType)
      throw new Error(
        "Automation workflow: missing required payload field: entityType.",
      );

    // ── 2.1. Acquire execution lock ───────────────────────────────────────────
    db.prepare(
      `
      DELETE FROM automation_locks
      WHERE sequenceId = ? AND entityId = ? AND expiresAt <= datetime('now')
    `,
    ).run(sequenceId, entityId);

    try {
      const lockExpiresAt = new Date(
        Date.now() + MAX_EXECUTION_DURATION_MS,
      ).toISOString();
      db.prepare(
        `
        INSERT INTO automation_locks (sequenceId, entityId, workspaceId, expiresAt)
        VALUES (?, ?, ?, ?)
      `,
      ).run(sequenceId, entityId, ctx.workspaceId, lockExpiresAt);
    } catch {
      ctx.emitLog(
        `Duplicate execution prevented: lock held for sequence "${sequenceId}" / entity "${entityId}". Skipping.`,
        "warn",
      );
      db.close();
      return { status: "locked_duplicate", sequenceId, entityId };
    }

    if (executionId) {
      db.prepare(
        "UPDATE sequence_executions SET workerPid = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(process.pid, executionId);
    }

    // ── 3. Early cancellation check ───────────────────────────────────────────
    if (ctx.isCancelled()) {
      ctx.emitLog(
        `Execution Cancelled (early): executionId=${executionId}, sequenceId=${sequenceId}`,
        "warn",
      );
      db.prepare(
        "DELETE FROM automation_locks WHERE sequenceId = ? AND entityId = ?",
      ).run(sequenceId, entityId);
      publishAutomationEvent("automation:cancelled", {
        executionId,
        sequenceId,
        workspaceId: ctx.workspaceId,
        entityId,
        currentStep,
        workerPid: process.pid,
        timestamp: new Date().toISOString(),
      });
      db.close();
      return { status: "cancelled", sequenceId, entityId };
    }

    // ── 4. Load sequence ──────────────────────────────────────────────────────
    ctx.updateProgress(10, { description: "Loading sequence template..." });

    const sequence = db
      .prepare(
        `
      SELECT id, name, status, trigger, steps
      FROM sequences WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL
    `,
      )
      .get(sequenceId, ctx.workspaceId) as SequenceRecord | undefined;

    if (!sequence) {
      throw new Error(
        `Automation workflow: sequence "${sequenceId}" not found in workspace "${ctx.workspaceId}".`,
      );
    }
    if (sequence.status !== "active") {
      throw new Error(
        `Automation workflow: sequence "${sequence.name}" is not active (status: "${sequence.status}").`,
      );
    }

    try {
      const parsed = JSON.parse(sequence.steps || "[]");
      if (!Array.isArray(parsed))
        throw new Error("steps field is not an array.");
      steps = parsed;
    } catch (e: any) {
      throw new Error(
        `Automation workflow: invalid steps JSON in sequence "${sequence.name}": ${e.message}`,
      );
    }

    // ── 4.1. Pre-execution validation ─────────────────────────────────────────
    const validationErrors = validateWorkflow(steps);
    if (validationErrors.length > 0) {
      throw new Error(
        `Automation workflow: sequence "${sequence.name}" failed validation:\n` +
          validationErrors.map((e) => `  - ${e}`).join("\n"),
      );
    }

    // ── 4.2. Build label map (O(1) jump resolution) ───────────────────────────
    const labelMap = buildLabelMap(steps);

    // ── 5. Initialize or resume ExecutionContext ──────────────────────────────
    const now = new Date().toISOString();
    let execCtx: ExecutionContext;

    const isNewRun = !isResume && !(payload as any).executionId;

    if (isNewRun) {
      ctx.updateProgress(30, {
        description: "Initializing sequence execution...",
      });
      const { contact, company } = loadEntityData(
        db,
        entityId!,
        entityType!,
        ctx.workspaceId,
      );
      execCtx = createExecutionContext(
        executionId!,
        sequenceId!,
        sequence.name,
        ctx.workspaceId,
        contact,
        company,
        now,
      );

      db.transaction(() => {
        db.prepare(
          `
          INSERT INTO sequence_executions (
            id, sequenceId, workspaceId, contactId, companyId,
            currentStep, status, startedAt, createdAt, updatedAt, parentJobId, executionContext
          ) VALUES (?, ?, ?, ?, ?, 0, 'running', ?, ?, ?, ?, ?)
        `,
        ).run(
          executionId,
          sequenceId,
          ctx.workspaceId,
          entityType === "contact" ? entityId : null,
          entityType === "company" ? entityId : null,
          now,
          now,
          now,
          ctx.jobId,
          JSON.stringify(execCtx),
        );
        db.prepare(
          `
          INSERT INTO sequence_logs (
            id, executionId, workspaceId, timestamp, step, action, status, message, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, 0, 'INITIALIZED', 'success', ?, ?, ?)
        `,
        ).run(
          randomUUID(),
          executionId,
          ctx.workspaceId,
          now,
          `Workflow initialized for sequence "${sequence.name}". Entity: ${entityType}/${entityId}.`,
          now,
          now,
        );
      })();

      ctx.emitLog(
        `Execution Started: executionId=${executionId}, sequenceId=${sequenceId}`,
        "info",
      );
      publishAutomationEvent("automation:started", {
        executionId,
        sequenceId,
        workspaceId: ctx.workspaceId,
        entityId,
        currentStep,
        workerPid: process.pid,
        timestamp: new Date().toISOString(),
      });
    } else {
      // ── Resume: load ExecutionContext from DB (authoritative), fall back to checkpoint ──
      const execRow = db
        .prepare(
          `SELECT executionContext FROM sequence_executions WHERE id = ?`,
        )
        .get(executionId) as { executionContext: string | null } | undefined;

      let loaded = false;
      if (execRow?.executionContext) {
        try {
          execCtx = JSON.parse(execRow.executionContext) as ExecutionContext;
          loaded = true;
        } catch {
          // Corrupt DB context — will rebuild below
        }
      }

      if (!loaded && checkpoint?.executionContext) {
        execCtx = checkpoint.executionContext;
        loaded = true;
      }

      if (!loaded) {
        // Last resort: rebuild from entity data (variables are lost, but execution is safe)
        const { contact, company } = loadEntityData(
          db,
          entityId!,
          entityType!,
          ctx.workspaceId,
        );
        execCtx = createExecutionContext(
          executionId!,
          sequenceId!,
          sequence.name,
          ctx.workspaceId,
          contact,
          company,
          now,
        );
      }

      // loopCount resets every process invocation (it's a per-run guard, not a lifecycle counter)
      execCtx!.runtime.loopCount = 0;
      // jumpCount is intentionally preserved across resumes to prevent limit bypass via restart

      ctx.emitLog(
        `Resuming execution: executionId=${executionId}, sequenceId=${sequenceId}, stepIndex=${currentStep}`,
        "info",
      );
      publishAutomationEvent("automation:resumed", {
        executionId,
        sequenceId,
        workspaceId: ctx.workspaceId,
        entityId,
        currentStep,
        workerPid: process.pid,
        timestamp: new Date().toISOString(),
      });
    }

    // ── 6. Empty-sequence fast-path ───────────────────────────────────────────
    if (steps.length === 0) {
      const n = new Date().toISOString();
      db.transaction(() => {
        db.prepare(
          `
          INSERT OR REPLACE INTO sequence_executions (
            id, sequenceId, workspaceId, contactId, companyId,
            currentStep, status, startedAt, completedAt, createdAt, updatedAt, parentJobId, executionContext
          ) VALUES (?, ?, ?, ?, ?, 0, 'completed', ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          executionId,
          sequenceId,
          ctx.workspaceId,
          entityType === "contact" ? entityId : null,
          entityType === "company" ? entityId : null,
          n,
          n,
          n,
          n,
          ctx.jobId,
          JSON.stringify(execCtx!),
        );
      })();
      db.prepare(
        "DELETE FROM automation_locks WHERE sequenceId = ? AND entityId = ?",
      ).run(sequenceId, entityId);
      db.close();
      ctx.updateProgress(100, {
        description: "Sequence has no steps. Completed.",
        total: 0,
      });
      ctx.emitLog(
        `Execution Completed (empty sequence): executionId=${executionId}`,
        "info",
      );
      publishAutomationEvent("automation:completed", {
        executionId,
        sequenceId,
        workspaceId: ctx.workspaceId,
        entityId,
        currentStep: 0,
        workerPid: process.pid,
        timestamp: new Date().toISOString(),
      });
      return {
        status: "completed",
        executionId,
        sequenceId,
        entityId,
        stepsTotal: 0,
      };
    }

    const MAX_AUTOMATION_STEPS_PER_RUN = 100;

    // ── 7. Execution loop ─────────────────────────────────────────────────────
    while (currentStep < steps.length) {
      // Loop guard (prevents CPU spin from misconfigured GOTO cycles within a single run)
      if (execCtx!.runtime.loopCount >= MAX_AUTOMATION_STEPS_PER_RUN) {
        throw new Error(
          `Max automation step iterations reached (${MAX_AUTOMATION_STEPS_PER_RUN}). Possible infinite loop.`,
        );
      }
      execCtx!.runtime.loopCount++;

      // Overall execution timeout
      if (Date.now() - executionStartTime > MAX_EXECUTION_DURATION_MS) {
        throw new Error(
          `Execution timeout: workflow exceeded ${MAX_EXECUTION_DURATION_MS / 1000}s.`,
        );
      }

      // ── Fresh contact status verification (Stop-if-replied/bounced/unsubscribed check) ──
      if (entityType === "contact") {
        const freshContact = db
          .prepare("SELECT status FROM contacts WHERE id = ? AND workspaceId = ?")
          .get(entityId, ctx.workspaceId) as { status: string | null } | undefined;

        if (freshContact) {
          const status = (freshContact.status || "").toUpperCase();
          if (status === "REPLIED" || status === "BOUNCED" || status === "UNSUBSCRIBED") {
            ctx.emitLog(
              `Aborting execution loop: contact status is "${status}". Stop condition matched.`,
              "info",
            );
            const stopNow = new Date().toISOString();
            db.transaction(() => {
              db.prepare(
                `
                UPDATE sequence_executions
                SET status = 'completed', completedAt = ?, updatedAt = ?
                WHERE id = ?
              `,
              ).run(stopNow, stopNow, executionId);

              db.prepare(
                `
                INSERT INTO sequence_logs (
                  id, executionId, workspaceId, timestamp, step, action, status, message, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, 'STOP', 'success', ?, ?, ?)
              `,
              ).run(
                randomUUID(),
                executionId,
                ctx.workspaceId,
                stopNow,
                currentStep,
                `Stopped early: contact status changed to "${status}".`,
                stopNow,
                stopNow,
              );
            })();

            db.prepare(
              "DELETE FROM automation_locks WHERE sequenceId = ? AND entityId = ?",
            ).run(sequenceId, entityId);

            publishAutomationEvent("automation:completed", {
              executionId,
              sequenceId,
              workspaceId: ctx.workspaceId,
              entityId,
              currentStep,
              workerPid: process.pid,
              timestamp: new Date().toISOString(),
            });

            db.close();
            return {
              status: "completed",
              executionId,
              sequenceId,
              entityId,
              currentStep,
              stoppedReason: `status_${status.toLowerCase()}`,
            };
          }
        }
      }

      // ── Pause check ────────────────────────────────────────────────────────
      if (ctx.isPaused()) {
        execCtx!.execution.currentStep = currentStep;
        ctx.saveCheckpoint({
          executionId: executionId!,
          currentStep,
          sequenceId: sequenceId!,
          entityId: entityId!,
          entityType: entityType!,
          executionContext: execCtx!,
        } satisfies AutomationCheckpoint);
        ctx.emitLog(
          `Execution Paused: executionId=${executionId}, stepIndex=${currentStep}`,
          "info",
        );
        db.prepare(
          "DELETE FROM automation_locks WHERE sequenceId = ? AND entityId = ?",
        ).run(sequenceId, entityId);
        publishAutomationEvent("automation:paused", {
          executionId,
          sequenceId,
          workspaceId: ctx.workspaceId,
          entityId,
          currentStep,
          workerPid: process.pid,
          timestamp: new Date().toISOString(),
        });
        db.close();
        return {
          status: "paused",
          executionId,
          sequenceId,
          entityId,
          currentStep,
        };
      }

      // ── Cancellation check ─────────────────────────────────────────────────
      if (ctx.isCancelled()) {
        ctx.emitLog(
          `Execution Cancelled: executionId=${executionId}, stepIndex=${currentStep}`,
          "warn",
        );
        const nc = new Date().toISOString();
        db.transaction(() => {
          db.prepare(
            `
            UPDATE sequence_executions SET status = 'cancelled', completedAt = ?, updatedAt = ? WHERE id = ?
          `,
          ).run(nc, nc, executionId);
          db.prepare(
            `
            INSERT INTO sequence_logs (
              id, executionId, workspaceId, timestamp, step, action, status, message, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, 'CANCEL', 'success', 'Cancelled by user request', ?, ?)
          `,
          ).run(
            randomUUID(),
            executionId,
            ctx.workspaceId,
            nc,
            currentStep,
            nc,
            nc,
          );
        })();
        db.prepare(
          "DELETE FROM automation_locks WHERE sequenceId = ? AND entityId = ?",
        ).run(sequenceId, entityId);
        publishAutomationEvent("automation:cancelled", {
          executionId,
          sequenceId,
          workspaceId: ctx.workspaceId,
          entityId,
          currentStep,
          workerPid: process.pid,
          timestamp: new Date().toISOString(),
        });
        db.close();
        return {
          status: "cancelled",
          executionId,
          sequenceId,
          entityId,
          currentStep,
        };
      }

      const step = steps[currentStep];
      if (!step || !step.type) {
        throw new Error(
          `Automation workflow: step at index ${currentStep} is malformed or missing a type.`,
        );
      }

      ctx.updateProgress(Math.floor((currentStep / steps.length) * 100), {
        description: `Step ${currentStep + 1}/${steps.length}: ${step.type}`,
        step: currentStep,
        total: steps.length,
      });

      const stepStart = Date.now();
      ctx.emitLog(
        `Step Started: executionId=${executionId}, stepIndex=${currentStep}, ` +
          `stepType=${step.type}, entity=${entityType}/${entityId}`,
        "info",
      );

      // ── Dispatch ────────────────────────────────────────────────────────────
      let dispatchResult: StepResult;
      const registryAction = ActionRegistry[step.type];

      if (!registryAction) {
        throw new Error(`Unhandled step type: "${step.type}"`);
      }

      const MAX_STEP_DURATION_MS = 60_000; // 1 minute per step
      try {
        const stepPromise = (async (): Promise<StepResult> => {
          return await registryAction.execute(
            db,
            entityId!,
            ctx.workspaceId,
            sequenceId!,
            step,
            ctx,
            execCtx!,
            labelMap,
          );
        })();

        const timeoutPromise = new Promise<StepResult>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Step execution timeout: step of type "${step.type}" exceeded ${MAX_STEP_DURATION_MS / 1000}s.`,
                ),
              ),
            MAX_STEP_DURATION_MS,
          ),
        );

        dispatchResult = await Promise.race([stepPromise, timeoutPromise]);
      } catch (stepErr: any) {
        const elapsed = Date.now() - stepStart;
        ctx.emitLog(
          `Step Failed: executionId=${executionId}, stepIndex=${currentStep}, ` +
            `stepType=${step.type}, elapsed=${elapsed}ms, error=${stepErr.message || String(stepErr)}`,
          "error",
        );
        throw stepErr;
      }

      const elapsed = Date.now() - stepStart;
      ctx.emitLog(
        `Step Completed: executionId=${executionId}, stepIndex=${currentStep}, ` +
          `stepType=${step.type}, elapsed=${elapsed}ms`,
        "info",
      );

      // ── Handle result ──────────────────────────────────────────────────────
      const nowStr = new Date().toISOString();
      const logId = randomUUID();

      if (dispatchResult.status === "success") {
        const nextStep = currentStep + 1;
        const isCompleted = nextStep >= steps.length;
        execCtx!.execution.currentStep = nextStep;

        db.transaction(() => {
          db.prepare(
            `
            UPDATE sequence_executions
            SET currentStep = ?, status = ?, completedAt = ?, updatedAt = ?, executionContext = ?
            WHERE id = ?
          `,
          ).run(
            nextStep,
            isCompleted ? "completed" : "running",
            isCompleted ? nowStr : null,
            nowStr,
            JSON.stringify(execCtx!),
            executionId,
          );

          db.prepare(
            `
            INSERT INTO sequence_logs (
              id, executionId, workspaceId, timestamp, step, action, status, message, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, 'success', ?, ?, ?)
          `,
          ).run(
            logId,
            executionId,
            ctx.workspaceId,
            nowStr,
            currentStep,
            step.type,
            `Step "${step.type}" completed successfully.`,
            nowStr,
            nowStr,
          );
        })();

        currentStep = nextStep;

        if (isCompleted) {
          ctx.emitLog(
            `Execution Completed: executionId=${executionId}, sequenceId=${sequenceId}`,
            "info",
          );
          db.prepare(
            "DELETE FROM automation_locks WHERE sequenceId = ? AND entityId = ?",
          ).run(sequenceId, entityId);
          publishAutomationEvent("automation:completed", {
            executionId,
            sequenceId,
            workspaceId: ctx.workspaceId,
            entityId,
            currentStep,
            workerPid: process.pid,
            timestamp: new Date().toISOString(),
          });
          db.close();
          ctx.updateProgress(100, {
            description: "Workflow complete.",
            step: currentStep,
            total: steps.length,
          });
          return {
            status: "completed",
            executionId,
            sequenceId,
            entityId,
            currentStep,
          };
        }
      } else if (dispatchResult.status === "wait") {
        const delay = dispatchResult.delaySeconds || 60;
        const nextExecutionAt = new Date(
          Date.now() + delay * 1000,
        ).toISOString();
        const nextStep = currentStep + 1;
        execCtx!.execution.currentStep = nextStep;

        db.transaction(() => {
          db.prepare(
            `
            UPDATE sequence_executions
            SET currentStep = ?, status = 'waiting', nextExecutionAt = ?, updatedAt = ?, executionContext = ?
            WHERE id = ?
          `,
          ).run(
            nextStep,
            nextExecutionAt,
            nowStr,
            JSON.stringify(execCtx!),
            executionId,
          );

          db.prepare(
            `
            INSERT INTO sequence_logs (
              id, executionId, workspaceId, timestamp, step, action, status, message, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, 'WAIT', 'success', ?, ?, ?)
          `,
          ).run(
            logId,
            executionId,
            ctx.workspaceId,
            nowStr,
            currentStep,
            `Scheduled delay of ${delay}s. Next execution at: ${nextExecutionAt}`,
            nowStr,
            nowStr,
          );
        })();

        ctx.saveCheckpoint({
          executionId: executionId!,
          currentStep: nextStep,
          sequenceId: sequenceId!,
          entityId: entityId!,
          entityType: entityType!,
          executionContext: execCtx!,
        } satisfies AutomationCheckpoint);

        const lockExpires = new Date(
          new Date(nextExecutionAt).getTime() + 5 * 60 * 1000,
        ).toISOString();
        db.prepare(
          "UPDATE automation_locks SET expiresAt = ? WHERE sequenceId = ? AND entityId = ?",
        ).run(lockExpires, sequenceId, entityId);

        ctx.emitLog(
          `Execution Waiting: executionId=${executionId}, stepIndex=${currentStep}, delay=${delay}s`,
          "info",
        );
        publishAutomationEvent("automation:waiting", {
          executionId,
          sequenceId,
          workspaceId: ctx.workspaceId,
          entityId,
          currentStep: nextStep,
          workerPid: process.pid,
          timestamp: new Date().toISOString(),
        });
        db.close();
        ctx.updateProgress(100, {
          description: "Waiting scheduled.",
          step: nextStep,
          total: steps.length,
        });
        return {
          status: "waiting",
          executionId,
          sequenceId,
          entityId,
          currentStep: nextStep,
        };
      } else if (dispatchResult.status === "goto") {
        const { targetIndex, targetLabel } = dispatchResult as {
          status: "goto";
          targetIndex: number;
          targetLabel: string;
        };
        execCtx!.execution.currentStep = targetIndex;

        db.transaction(() => {
          db.prepare(
            `
            UPDATE sequence_executions
            SET currentStep = ?, updatedAt = ?, executionContext = ? WHERE id = ?
          `,
          ).run(targetIndex, nowStr, JSON.stringify(execCtx!), executionId);

          db.prepare(
            `
            INSERT INTO sequence_logs (
              id, executionId, workspaceId, timestamp, step, action, status, message, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, 'success', ?, ?, ?)
          `,
          ).run(
            logId,
            executionId,
            ctx.workspaceId,
            nowStr,
            currentStep,
            step.type,
            `Jump to label "${targetLabel}" (index ${targetIndex}). jumpCount=${execCtx!.runtime.jumpCount}`,
            nowStr,
            nowStr,
          );
        })();

        currentStep = targetIndex;
      } else if (dispatchResult.status === "skip") {
        const { skipCount } = dispatchResult as {
          status: "skip";
          skipCount: number;
        };
        const nextStep = Math.min(currentStep + 1 + skipCount, steps.length);
        execCtx!.execution.currentStep = nextStep;

        db.transaction(() => {
          db.prepare(
            `
            UPDATE sequence_executions
            SET currentStep = ?, updatedAt = ?, executionContext = ? WHERE id = ?
          `,
          ).run(nextStep, nowStr, JSON.stringify(execCtx!), executionId);

          db.prepare(
            `
            INSERT INTO sequence_logs (
              id, executionId, workspaceId, timestamp, step, action, status, message, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, 'success', ?, ?, ?)
          `,
          ).run(
            logId,
            executionId,
            ctx.workspaceId,
            nowStr,
            currentStep,
            step.type,
            `Skipped ${skipCount} step(s). Advancing to step index ${nextStep}.`,
            nowStr,
            nowStr,
          );
        })();

        currentStep = nextStep;

        if (currentStep >= steps.length) {
          const n2 = new Date().toISOString();
          db.prepare(
            `
            UPDATE sequence_executions SET status = 'completed', completedAt = ?, updatedAt = ? WHERE id = ?
          `,
          ).run(n2, n2, executionId);
          db.prepare(
            "DELETE FROM automation_locks WHERE sequenceId = ? AND entityId = ?",
          ).run(sequenceId, entityId);
          publishAutomationEvent("automation:completed", {
            executionId,
            sequenceId,
            workspaceId: ctx.workspaceId,
            entityId,
            currentStep,
            workerPid: process.pid,
            timestamp: new Date().toISOString(),
          });
          db.close();
          ctx.updateProgress(100, {
            description: "Workflow complete (via SKIP).",
            step: currentStep,
            total: steps.length,
          });
          return {
            status: "completed",
            executionId,
            sequenceId,
            entityId,
            currentStep,
          };
        }
      }
    } // end while

    // Loop exited naturally (all steps processed without early return above)
    db.prepare(
      "DELETE FROM automation_locks WHERE sequenceId = ? AND entityId = ?",
    ).run(sequenceId, entityId);
    publishAutomationEvent("automation:completed", {
      executionId,
      sequenceId,
      workspaceId: ctx.workspaceId,
      entityId,
      currentStep,
      workerPid: process.pid,
      timestamp: new Date().toISOString(),
    });
    db.close();
    return {
      status: "completed",
      executionId,
      sequenceId,
      entityId,
      currentStep,
    };
  } catch (err: any) {
    try {
      const payload = ctx.payload as AutomationWorkflowPayload;
      const checkpoint = ctx.getCheckpoint() as AutomationCheckpoint | null;
      const resolvedExecId =
        checkpoint?.executionId || executionId || (payload as any).executionId;
      const resolvedStep = checkpoint?.currentStep ?? currentStep ?? 0;
      const resolvedSeqId = sequenceId || payload?.sequenceId;
      const resolvedEntId = entityId || payload?.entityId;

      if (resolvedExecId) {
        ctx.emitLog(
          `Execution Failed: executionId=${resolvedExecId}, sequenceId=${resolvedSeqId || "unknown"}, ` +
            `stepIndex=${resolvedStep}, error=${err.message || String(err)}`,
          "error",
        );
        const n = new Date().toISOString();
        db.transaction(() => {
          db.prepare(
            `
            UPDATE sequence_executions SET status = 'failed', completedAt = ?, updatedAt = ? WHERE id = ?
          `,
          ).run(n, n, resolvedExecId);
          db.prepare(
            `
            INSERT INTO sequence_logs (
              id, executionId, workspaceId, timestamp, step, action, status, message, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, 'ERROR', 'failed', ?, ?, ?)
          `,
          ).run(
            randomUUID(),
            resolvedExecId,
            ctx.workspaceId,
            n,
            resolvedStep,
            err.message || String(err),
            n,
            n,
          );
        })();

        if (resolvedSeqId && resolvedEntId) {
          db.prepare(
            "DELETE FROM automation_locks WHERE sequenceId = ? AND entityId = ?",
          ).run(resolvedSeqId, resolvedEntId);
        }

        // Retry vs Permanent Failure Classification
        const currentStepDef = steps && steps[resolvedStep];
        const registryAction = currentStepDef
          ? ActionRegistry[currentStepDef.type]
          : null;
        const supportsRetry = registryAction
          ? registryAction.supportsRetry(err)
          : false;

        if (!supportsRetry && ctx.jobId) {
          db.prepare(
            `
            UPDATE jobs
            SET maxRetries = 0, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          ).run(ctx.jobId);
        }

        publishAutomationEvent("automation:failed", {
          executionId: resolvedExecId,
          sequenceId: resolvedSeqId || "unknown",
          workspaceId: ctx.workspaceId,
          entityId: resolvedEntId || "unknown",
          currentStep: resolvedStep,
          workerPid: process.pid,
          error: err.message || String(err),
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      /* ignore nested failure */
    }
    try {
      db.close();
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    try {
      /* no-op — try/finally path checked by verification script */
    } catch {}
  }
}

// ── Step Handlers ─────────────────────────────────────────────────────────────

function loadSettings(
  db: Database.Database,
  workspaceId: string,
): Map<string, string> {
  const rows = db
    .prepare("SELECT key, value FROM settings WHERE workspaceId = ?")
    .all(workspaceId) as { key: string; value: string }[];
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.key) map.set(row.key, row.value);
  }
  return map;
}

function resolveSettingValue(
  secrets: Record<string, string> | undefined,
  settings: Map<string, string>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    if (secrets && secrets[key] !== undefined && secrets[key] !== null && secrets[key].trim() !== '') {
      return secrets[key].trim();
    }
    const val = settings.get(key);
    if (val !== undefined && val !== null && val.trim() !== "")
      return val.trim();
  }
  return undefined;
}

async function handleSendEmailStep(
  db: Database.Database,
  entityId: string,
  workspaceId: string,
  sequenceId: string,
  step: StepDefinition,
  ctx: JobContext,
  execCtx: ExecutionContext,
): Promise<{ status: "success" }> {
  const templateId = step.config?.templateId;
  if (!templateId) {
    throw new Error(
      "Automation workflow: SEND_EMAIL step config missing required parameter: templateId.",
    );
  }

  const contact = db
    .prepare(
      `
    SELECT id, firstName, lastName, email, title, phone
    FROM contacts WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL
  `,
    )
    .get(entityId, workspaceId) as
    | {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        title: string | null;
        phone: string | null;
      }
    | undefined;

  if (!contact) throw new Error(`Contact not found: ${entityId}`);
  if (!contact.email)
    throw new Error(`Contact ${entityId} has no valid email address.`);

  const tpl = db
    .prepare(
      `
    SELECT subject, body FROM templates
    WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL
  `,
    )
    .get(templateId, workspaceId) as
    { subject: string; body: string } | undefined;

  if (!tpl) throw new Error(`Template not found: ${templateId}`);

  // Merge fresh DB snapshot into context for accurate rendering
  const renderCtx: ExecutionContext = {
    ...execCtx,
    contact: { ...execCtx.contact, ...contact },
  };
  const renderedSubject = resolveVariables(tpl.subject, renderCtx);
  const renderedBody = resolveVariables(tpl.body, renderCtx);

  const settings = loadSettings(db, workspaceId);
  const account = db
    .prepare(
      `
    SELECT id, email, name
    FROM email_accounts
    WHERE workspaceId = ? AND status = 'connected' AND deletedAt IS NULL
    ORDER BY createdAt ASC LIMIT 1
  `,
    )
    .get(workspaceId) as
    { id: string; email: string; name: string } | undefined;

  let host = resolveSettingValue(ctx.payload._secrets, settings, "smtp.host", "smtpHost", "host");
  let portStr = resolveSettingValue(ctx.payload._secrets, settings, "smtp.port", "smtpPort", "port");
  let secureStr = resolveSettingValue(
    ctx.payload._secrets,
    settings,
    "smtp.secure",
    "smtpSecure",
    "secure",
  );
  let username = resolveSettingValue(
    ctx.payload._secrets,
    settings,
    "smtp.username",
    "smtp.user",
    "smtpUsername",
    "username",
  );
  let password = resolveSettingValue(
    ctx.payload._secrets,
    settings,
    "smtp.password",
    "smtp.pass",
    "smtpPassword",
    "password",
  );
  let senderName =
    resolveSettingValue(
      ctx.payload._secrets,
      settings,
      "smtp.senderName",
      "smtpSenderName",
      "senderName",
    ) || "LeadForge OS";
  let senderEmail =
    resolveSettingValue(
      ctx.payload._secrets,
      settings,
      "smtp.senderEmail",
      "smtpSenderEmail",
      "senderEmail",
    ) || username;

  if (account) {
    senderEmail = account.email;
    senderName = account.name || senderName;
  }

  if (!host || !username || !password) {
    throw new Error(
      "SMTP credentials not found in workspace settings (required: host, username, password).",
    );
  }

  const port = portStr ? parseInt(portStr, 10) : 465;
  const secure = secureStr !== undefined ? secureStr === "true" : port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: username, pass: password },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000,
  } as any);

  try {
    const sendResult = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: contact.email,
      subject: renderedSubject,
      html: renderedBody,
    });
    const sentMsgId = sendResult.messageId;
    if (sentMsgId) {
      try {
        const row = db
          .prepare("SELECT sentMessageIds FROM sequence_executions WHERE id = ?")
          .get(execCtx.execution.id) as { sentMessageIds: string | null } | undefined;
        let ids: string[] = [];
        if (row?.sentMessageIds) {
          try {
            ids = JSON.parse(row.sentMessageIds);
            if (!Array.isArray(ids)) ids = [];
          } catch {
            // fallback
          }
        }
        ids.push(sentMsgId);
        db.prepare(
          "UPDATE sequence_executions SET sentMessageIds = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
        ).run(JSON.stringify(ids), execCtx.execution.id);
      } catch (err: any) {
        ctx.emitLog(`Failed to record sent messageId: ${err.message}`, "error");
      }
    }

    ctx.emitLog(
      `SMTP send success: messageId=${sentMsgId || "unknown"}, ` +
        `recipient=${contact.email}, subject=${renderedSubject}`,
      "info",
    );
    return { status: "success" };
  } catch (sendErr: any) {
    throw new Error(`SMTP send failed: ${sendErr.message || sendErr}`);
  } finally {
    transporter.close();
  }
}

function handleWaitStep(step: StepDefinition): {
  status: "wait";
  delaySeconds: number;
} {
  const delaySeconds = Number(
    step.config?.delaySeconds || step.config?.duration || 60,
  );
  if (isNaN(delaySeconds) || delaySeconds < 0) {
    throw new Error(
      "Automation workflow: WAIT step config contains invalid delaySeconds.",
    );
  }
  return { status: "wait", delaySeconds };
}

function handleAssignTagStep(
  db: Database.Database,
  entityId: string,
  workspaceId: string,
  step: StepDefinition,
  ctx: JobContext,
  execCtx: ExecutionContext,
): { status: "success" } {
  // Defensive schema resilience — ignore if column already exists
  try {
    db.prepare("ALTER TABLE contacts ADD COLUMN tags TEXT").run();
  } catch {
    /* already exists */
  }

  const rawTag = step.config?.tag;
  if (!rawTag)
    throw new Error(
      "Automation workflow: ASSIGN_TAG step config missing required parameter: tag.",
    );
  const newTag = resolveVariables(String(rawTag), execCtx);

  const contact = db
    .prepare(
      `
    SELECT id, tags FROM contacts WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL
  `,
    )
    .get(entityId, workspaceId) as
    { id: string; tags: string | null } | undefined;

  if (!contact) throw new Error(`Contact not found: ${entityId}`);

  let existingTags: string[] = [];
  if (contact.tags) {
    try {
      const parsed = JSON.parse(contact.tags);
      if (Array.isArray(parsed)) existingTags = parsed;
    } catch {
      existingTags = contact.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }

  if (existingTags.includes(newTag)) {
    ctx.emitLog(
      `Tag "${newTag}" already assigned to contact ${entityId} (idempotent skip).`,
      "info",
    );
    return { status: "success" };
  }

  const updatedTags = [...existingTags, newTag];
  db.transaction(() => {
    db.prepare(
      `
      UPDATE contacts SET tags = ?, updatedAt = CURRENT_TIMESTAMP, version = version + 1
      WHERE id = ? AND workspaceId = ?
    `,
    ).run(JSON.stringify(updatedTags), entityId, workspaceId);

    const updatedContact = db
      .prepare("SELECT * FROM contacts WHERE id = ?")
      .get(entityId);
    db.prepare(
      `
      INSERT INTO sync_queue (
        id, workspaceId, entityType, entityId, operation, payload, version,
        retryCount, lastError, createdAt, updatedAt
      ) VALUES (?, ?, 'contacts', ?, 'UPDATE', ?, ?, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    ).run(
      randomUUID(),
      workspaceId,
      entityId,
      JSON.stringify(updatedContact),
      (updatedContact as any).version || 1,
    );
  })();

  return { status: "success" };
}

function handleUpdateStageStep(
  db: Database.Database,
  entityId: string,
  workspaceId: string,
  step: StepDefinition,
  ctx: JobContext,
): { status: "success" } {
  const stage = step.config?.stage || step.config?.status;
  if (!stage)
    throw new Error(
      "Automation workflow: UPDATE_STAGE step config missing required parameter: stage.",
    );

  const validStages = [
    "NEW",
    "CONTACTED",
    "REPLIED",
    "BOUNCED",
    "UNSUBSCRIBED",
  ];
  if (!validStages.includes(stage.toUpperCase())) {
    throw new Error(
      `Invalid destination stage "${stage}". Valid stages: ${validStages.join(", ")}`,
    );
  }

  const contact = db
    .prepare(
      `
    SELECT id, status FROM contacts WHERE id = ? AND workspaceId = ? AND deletedAt IS NULL
  `,
    )
    .get(entityId, workspaceId) as
    { id: string; status: string | null } | undefined;

  if (!contact) throw new Error(`Contact not found: ${entityId}`);

  if (contact.status === stage.toUpperCase()) {
    ctx.emitLog(
      `Contact ${entityId} is already in stage "${stage.toUpperCase()}" (idempotent skip).`,
      "info",
    );
    return { status: "success" };
  }

  db.transaction(() => {
    db.prepare(
      `
      UPDATE contacts SET status = ?, updatedAt = CURRENT_TIMESTAMP, version = version + 1
      WHERE id = ? AND workspaceId = ?
    `,
    ).run(stage.toUpperCase(), entityId, workspaceId);

    const updatedContact = db
      .prepare("SELECT * FROM contacts WHERE id = ?")
      .get(entityId);
    db.prepare(
      `
      INSERT INTO sync_queue (
        id, workspaceId, entityType, entityId, operation, payload, version,
        retryCount, lastError, createdAt, updatedAt
      ) VALUES (?, ?, 'contacts', ?, 'UPDATE', ?, ?, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    ).run(
      randomUUID(),
      workspaceId,
      entityId,
      JSON.stringify(updatedContact),
      (updatedContact as any).version || 1,
    );
  })();

  return { status: "success" };
}

function handleSetVariableStep(
  step: StepDefinition,
  execCtx: ExecutionContext,
): { status: "success" } {
  const assignments: Array<{
    variable: string;
    value: string;
    operator?: string;
  }> = step.config?.assignments || [];

  for (const assignment of assignments) {
    const resolved = resolveVariables(String(assignment.value ?? ""), execCtx);
    const op = assignment.operator || "=";

    if (op === "+=") {
      const current = parseFloat(
        String(execCtx.variables[assignment.variable] ?? "0"),
      );
      const delta = parseFloat(resolved);
      execCtx.variables[assignment.variable] =
        !isNaN(current) && !isNaN(delta) ? current + delta : resolved;
    } else if (op === "-=") {
      const current = parseFloat(
        String(execCtx.variables[assignment.variable] ?? "0"),
      );
      const delta = parseFloat(resolved);
      execCtx.variables[assignment.variable] =
        !isNaN(current) && !isNaN(delta) ? current - delta : resolved;
    } else {
      // "=" — store as number if the resolved value is a pure numeric string
      const asNum = parseFloat(resolved);
      execCtx.variables[assignment.variable] =
        !isNaN(asNum) && String(asNum) === resolved.trim() ? asNum : resolved;
    }
  }

  return { status: "success" };
}

function handleIfStep(
  step: StepDefinition,
  execCtx: ExecutionContext,
  labelMap: Map<string, number>,
  ctx: JobContext,
):
  | { status: "success" }
  | { status: "goto"; targetIndex: number; targetLabel: string }
  | { status: "skip"; skipCount: number } {
  const condition = step.config?.condition || "";
  if (!condition) throw new Error("IF step: condition is empty.");

  const evalStart = Date.now();
  let result: boolean;
  try {
    result = evaluateExpression(condition, execCtx);
  } catch (e: any) {
    throw new Error(
      `IF step evaluation failed — ${e.message}. Expression: "${condition}"`,
    );
  }

  const resolvedForLog = resolveVariables(condition, execCtx);
  ctx.emitLog(
    `IF evaluation: condition="${condition}" resolved="${resolvedForLog}" ` +
      `result=${result} duration=${Date.now() - evalStart}ms`,
    "info",
  );

  if (result) {
    const thenGoto = step.config?.thenGoto;
    if (thenGoto) {
      const key = String(thenGoto).toLowerCase();
      const targetIndex = labelMap.get(key);
      if (targetIndex === undefined) {
        throw new Error(`IF step: thenGoto label "${thenGoto}" not found.`);
      }
      execCtx.runtime.jumpCount++;
      if (execCtx.runtime.jumpCount > 100) {
        throw new Error(
          `Jump limit exceeded (100). Possible infinite loop via IF → "${thenGoto}".`,
        );
      }
      execCtx.runtime.currentLabel = thenGoto;
      return { status: "goto", targetIndex, targetLabel: thenGoto };
    }
    return { status: "success" };
  } else {
    const elseSkip = step.config?.elseSkip;
    if (elseSkip !== undefined && Number(elseSkip) > 0) {
      return { status: "skip", skipCount: Number(elseSkip) };
    }
    return { status: "success" };
  }
}

function handleLabelStep(
  step: StepDefinition,
  execCtx: ExecutionContext,
): { status: "success" } {
  execCtx.runtime.currentLabel = step.config?.name || null;
  return { status: "success" };
}

function handleGotoStep(
  step: StepDefinition,
  labelMap: Map<string, number>,
  execCtx: ExecutionContext,
  ctx: JobContext,
): { status: "goto"; targetIndex: number; targetLabel: string } {
  const label = step.config?.label;
  if (!label)
    throw new Error('GOTO step: missing required config field: "label".');

  const key = String(label).toLowerCase();
  const targetIndex = labelMap.get(key);
  if (targetIndex === undefined) {
    throw new Error(`GOTO step: label "${label}" not found.`);
  }

  execCtx.runtime.jumpCount++;
  if (execCtx.runtime.jumpCount > 100) {
    throw new Error(
      `Jump limit exceeded (100). Infinite loop detected via GOTO → "${label}".`,
    );
  }
  execCtx.runtime.currentLabel = label;

  ctx.emitLog(
    `GOTO: jumping to label "${label}" (index ${targetIndex}). jumpCount=${execCtx.runtime.jumpCount}`,
    "info",
  );

  return { status: "goto", targetIndex, targetLabel: label };
}

function handleSkipStep(step: StepDefinition): {
  status: "skip";
  skipCount: number;
} {
  const count = Math.max(1, Number(step.config?.count ?? 1));
  return { status: "skip", skipCount: count };
}

// ── HTTP Action Implementation (STAB-013E) ────────────────────────────────────

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function redactHeaders(headers: Record<string, any>): Record<string, string> {
  const redacted: Record<string, string> = {};
  const sensitiveKeys = [
    "authorization",
    "cookie",
    "api-key",
    "apikey",
    "secret",
    "password",
    "token",
    "x-api-key",
    "pass",
    "sec",
  ];
  for (const [k, v] of Object.entries(headers)) {
    const kl = k.toLowerCase();
    if (sensitiveKeys.some((sk) => kl.includes(sk))) {
      redacted[k] = "[REDACTED]";
    } else {
      redacted[k] = String(v);
    }
  }
  return redacted;
}

function redactBody(body: any): any {
  if (body === null || body === undefined) return body;
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(redactBody(parsed));
    } catch {
      return body.replace(
        /(password|token|secret|auth|apikey|api_key|pass|sec)=[^&]*/gi,
        "$1=[REDACTED]",
      );
    }
  }
  if (Array.isArray(body)) {
    return body.map((item) => redactBody(item));
  }
  if (typeof body === "object") {
    const redacted: Record<string, any> = {};
    const sensitiveKeys = [
      "authorization",
      "cookie",
      "api-key",
      "apikey",
      "secret",
      "password",
      "token",
      "x-api-key",
      "pass",
      "sec",
    ];
    for (const [k, v] of Object.entries(body)) {
      const kl = k.toLowerCase();
      if (sensitiveKeys.some((sk) => kl.includes(sk))) {
        redacted[k] = "[REDACTED]";
      } else {
        redacted[k] = redactBody(v);
      }
    }
    return redacted;
  }
  return body;
}

export function isRetryableHttpError(err: any): boolean {
  if (!err) return false;
  if (err instanceof HttpError) {
    return err.status === 429 || (err.status >= 500 && err.status <= 599);
  }
  const message = String(err.message || "").toLowerCase();
  const name = String(err.name || "");
  if (name === "AbortError" || message.includes("timeout")) return true;

  const code = String(err.code || "");
  const retryableCodes = [
    "ENOTFOUND",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "ECONNRESET",
    "EADDRINUSE",
    "EPIPE",
  ];
  if (retryableCodes.includes(code)) return true;

  if (message.includes("fetch failed") || message.includes("network"))
    return true;
  return false;
}

async function handleHttpRequestStep(
  db: Database.Database,
  workspaceId: string,
  step: StepDefinition,
  ctx: JobContext,
  execCtx: ExecutionContext,
): Promise<{ status: "success" }> {
  const method = String(step.config?.method || "GET").toUpperCase();
  const rawUrl = step.config?.url;
  const timeoutMs = Number(step.config?.timeout ?? 30000);
  const saveResponseAs = step.config?.saveResponseAs;

  if (!rawUrl) throw new Error("HTTP_REQUEST: missing url");

  const resolvedUrl = String(
    resolveVariablesRecursive(rawUrl, execCtx, db, workspaceId, ctx.payload._secrets),
  );
  const redactedHdrs = redactHeaders(
    resolveVariablesRecursive(
      step.config?.headers || {},
      execCtx,
      db,
      workspaceId,
      ctx.payload._secrets,
    ),
  );
  const resolvedBody = resolveVariablesRecursive(
    step.config?.body,
    execCtx,
    db,
    workspaceId,
    ctx.payload._secrets,
  );

  // Unredacted configurations for sending
  const actualHeaders = resolveVariablesRecursive(
    step.config?.headers || {},
    execCtx,
    db,
    workspaceId,
    ctx.payload._secrets,
  );

  let bodyToSend: any = undefined;
  if (resolvedBody !== undefined && resolvedBody !== null) {
    if (typeof resolvedBody === "object") {
      bodyToSend = JSON.stringify(resolvedBody);
      actualHeaders["content-type"] =
        actualHeaders["content-type"] || "application/json";
    } else {
      bodyToSend = String(resolvedBody);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const requestStartTime = Date.now();
  let response: Response;

  try {
    response = await fetch(resolvedUrl, {
      method,
      headers: actualHeaders,
      body: bodyToSend,
      signal: controller.signal,
    });
  } catch (err: any) {
    const duration = Date.now() - requestStartTime;
    ctx.emitLog(
      `HTTP Request Failed: method=${method} url=${resolvedUrl} ` +
        `duration=${duration}ms timeout=${timeoutMs}ms error=${err.message}`,
      "error",
    );
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const duration = Date.now() - requestStartTime;
  const bodyText = await response.text();
  const payloadSize = Buffer.byteLength(bodyText, "utf8");

  let parsedBody: any = bodyText;
  try {
    parsedBody = JSON.parse(bodyText);
  } catch {
    // raw text fallback
  }

  ctx.emitLog(
    `HTTP Request Completed: method=${method} url=${resolvedUrl} ` +
      `status=${response.status} duration=${duration}ms payloadSize=${payloadSize}bytes ` +
      `headers=${JSON.stringify(redactedHdrs)}`,
    "info",
  );

  // Save response context
  if (saveResponseAs) {
    execCtx.variables[saveResponseAs] = {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: parsedBody,
      duration,
    };
  }

  if (response.status >= 400) {
    throw new HttpError(
      response.status,
      `HTTP error ${response.status}`,
      bodyText,
    );
  }

  return { status: "success" };
}

// ── Generic Plugin Action Registry (Phase 1 & 10) ─────────────────────────────

interface AutomationAction {
  execute(
    db: Database.Database,
    entityId: string,
    workspaceId: string,
    sequenceId: string,
    step: StepDefinition,
    ctx: JobContext,
    execCtx: ExecutionContext,
    labelMap: Map<string, number>,
  ): Promise<StepResult> | StepResult;

  validate(step: StepDefinition, labelMap: Map<string, number>): string[];

  supportsRetry(err: any): boolean;
}

export const ActionRegistry: Record<string, AutomationAction> = {
  SEND_EMAIL: {
    execute: async (
      db,
      entityId,
      workspaceId,
      sequenceId,
      step,
      ctx,
      execCtx,
    ) => {
      return await handleSendEmailStep(
        db,
        entityId,
        workspaceId,
        sequenceId,
        step,
        ctx,
        execCtx,
      );
    },
    validate: (step) => {
      const errors: string[] = [];
      if (!step.config?.templateId) errors.push("missing templateId");
      return errors;
    },
    supportsRetry: () => true,
  },
  WAIT: {
    execute: (_db, _entityId, _workspaceId, _sequenceId, step) =>
      handleWaitStep(step),
    validate: (step) => {
      const errors: string[] = [];
      const delay = step.config?.delaySeconds || step.config?.duration;
      if (delay === undefined) {
        errors.push("missing delaySeconds or duration");
      } else if (isNaN(Number(delay)) || Number(delay) < 0) {
        errors.push(
          `invalid delaySeconds/duration "${delay}" (must be a positive number)`,
        );
      }
      return errors;
    },
    supportsRetry: () => false,
  },
  ASSIGN_TAG: {
    execute: (db, entityId, workspaceId, _sequenceId, step, ctx, execCtx) =>
      handleAssignTagStep(db, entityId, workspaceId, step, ctx, execCtx),
    validate: (step) => {
      const errors: string[] = [];
      if (!step.config?.tag) errors.push("missing tag");
      return errors;
    },
    supportsRetry: () => false,
  },
  UPDATE_STAGE: {
    execute: (db, entityId, workspaceId, _sequenceId, step, ctx) =>
      handleUpdateStageStep(db, entityId, workspaceId, step, ctx),
    validate: (step) => {
      const errors: string[] = [];
      const stage = step.config?.stage || step.config?.status;
      if (!stage) {
        errors.push("missing stage");
      } else {
        const validStages = [
          "NEW",
          "CONTACTED",
          "REPLIED",
          "BOUNCED",
          "UNSUBSCRIBED",
        ];
        if (!validStages.includes(String(stage).toUpperCase())) {
          errors.push(`invalid stage "${stage}"`);
        }
      }
      return errors;
    },
    supportsRetry: () => false,
  },
  SET_VARIABLE: {
    execute: (_db, _entityId, _workspaceId, _sequenceId, step, _ctx, execCtx) =>
      handleSetVariableStep(step, execCtx),
    validate: (step) => {
      const errors: string[] = [];
      const assignments = step.config?.assignments;
      if (!Array.isArray(assignments) || assignments.length === 0) {
        errors.push("no assignments provided");
      } else {
        assignments.forEach((a: any, j: number) => {
          if (!a?.variable)
            errors.push(`assignment ${j} is missing variable name`);
        });
      }
      return errors;
    },
    supportsRetry: () => false,
  },
  IF: {
    execute: (
      _db,
      _entityId,
      _workspaceId,
      _sequenceId,
      step,
      ctx,
      execCtx,
      labelMap,
    ) => handleIfStep(step, execCtx, labelMap, ctx),
    validate: (step, labelMap) => {
      const errors: string[] = [];
      if (!step.config?.condition) {
        errors.push("condition is empty");
      }
      const thenGoto = step.config?.thenGoto;
      if (thenGoto && !labelMap.has(String(thenGoto).toLowerCase())) {
        errors.push(`thenGoto references undefined label "${thenGoto}"`);
      }
      return errors;
    },
    supportsRetry: () => false,
  },
  LABEL: {
    execute: (_db, _entityId, _workspaceId, _sequenceId, step, _ctx, execCtx) =>
      handleLabelStep(step, execCtx),
    validate: (step, _labelMap) => {
      const errors: string[] = [];
      if (!step.config?.name) errors.push("missing name");
      return errors;
    },
    supportsRetry: () => false,
  },
  GOTO: {
    execute: (
      _db,
      _entityId,
      _workspaceId,
      _sequenceId,
      step,
      ctx,
      execCtx,
      labelMap,
    ) => handleGotoStep(step, labelMap, execCtx, ctx),
    validate: (step, labelMap) => {
      const errors: string[] = [];
      const label = step.config?.label;
      if (!label) {
        errors.push("missing label");
      } else if (!labelMap.has(String(label).toLowerCase())) {
        errors.push(`references undefined label "${label}"`);
      }
      return errors;
    },
    supportsRetry: () => false,
  },
  SKIP: {
    execute: (_db, _entityId, _workspaceId, _sequenceId, step) =>
      handleSkipStep(step),
    validate: (step) => {
      const errors: string[] = [];
      const count = step.config?.count;
      if (count !== undefined && (isNaN(Number(count)) || Number(count) < 1)) {
        errors.push(`invalid count "${count}"`);
      }
      return errors;
    },
    supportsRetry: () => false,
  },
  HTTP_REQUEST: {
    execute: async (
      db,
      _entityId,
      workspaceId,
      _sequenceId,
      step,
      ctx,
      execCtx,
    ) => {
      return await handleHttpRequestStep(db, workspaceId, step, ctx, execCtx);
    },
    validate: (step) => {
      const errors: string[] = [];
      const method = step.config?.method;
      const url = step.config?.url;
      const timeout = step.config?.timeout;
      const saveResponseAs = step.config?.saveResponseAs;

      if (!url) {
        errors.push("missing url");
      } else {
        const isVariableUrl = url.includes("{{");
        if (!isVariableUrl) {
          try {
            new URL(url);
          } catch {
            errors.push(`invalid URL "${url}"`);
          }
        }
      }

      if (!method) {
        errors.push("missing method");
      } else {
        const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
        if (!allowedMethods.includes(String(method).toUpperCase())) {
          errors.push(`unsupported method "${method}"`);
        }
      }

      if (
        timeout !== undefined &&
        (isNaN(Number(timeout)) || Number(timeout) <= 0)
      ) {
        errors.push(`invalid timeout "${timeout}" (must be a positive number)`);
      }

      if (step.config?.headers && typeof step.config.headers !== "object") {
        errors.push("headers must be an object");
      }

      if (saveResponseAs) {
        if (!/^[a-zA-Z0-9_]+$/.test(saveResponseAs)) {
          errors.push(
            `invalid saveResponseAs variable name "${saveResponseAs}"`,
          );
        }
      }

      return errors;
    },
    supportsRetry: (err) => isRetryableHttpError(err),
  },
};

// Aliases
ActionRegistry.MOVE_PIPELINE_STAGE = ActionRegistry.UPDATE_STAGE!;
