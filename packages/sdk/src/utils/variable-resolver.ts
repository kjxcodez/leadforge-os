/**
 * Canonical Variable Context structure for template rendering across LeadForge.
 */
export interface CanonicalVariableContext {
  contact?: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    title?: string | null;
    phone?: string | null;
    status?: string | null;
    source?: string | null;
    [key: string]: any;
  } | null;
  company?: {
    id?: string;
    name?: string | null;
    domain?: string | null;
    industry?: string | null;
    size?: string | null;
    location?: string | null;
    status?: string | null;
    website?: string | null;
    [key: string]: any;
  } | null;
  workspace?: {
    id?: string;
    name?: string;
  } | null;
  sequence?: {
    id?: string;
    name?: string;
  } | null;
  execution?: {
    id?: string;
    currentStep?: number | string;
    startedAt?: string;
  } | null;
  sender?: {
    name?: string;
    email?: string;
  } | null;
  variables?: Record<string, any> | null;
  [key: string]: any;
}

/**
 * Resolves a single dotted path token (e.g. "contact.firstName", "company.name")
 * against a CanonicalVariableContext, with legacy token aliases fallback.
 */
export function resolveTokenPath(path: string, ctx: CanonicalVariableContext): string {
  const trimmed = (path || '').trim();
  if (!trimmed) return '';

  const dotIdx = trimmed.indexOf('.');
  const ns = dotIdx === -1 ? trimmed : trimmed.slice(0, dotIdx);
  const field = dotIdx === -1 ? '' : trimmed.slice(dotIdx + 1);

  const contact = ctx.contact || {};
  const company = ctx.company || {};
  const workspace = ctx.workspace || {};
  const sequence = ctx.sequence || {};
  const execution = ctx.execution || {};
  const sender = ctx.sender || {};
  const variables = ctx.variables || {};

  switch (ns) {
    case 'contact': {
      if (!field || field === 'name') {
        const full = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
        return full || String(contact.email || '');
      }
      const val = contact[field];
      return val !== undefined && val !== null ? String(val) : '';
    }

    case 'company': {
      if (!field || field === 'name') {
        return String(company.name || '');
      }
      if (field === 'website' || field === 'domain') {
        return String(company.domain || company.website || '');
      }
      const val = company[field];
      return val !== undefined && val !== null ? String(val) : '';
    }

    case 'workspace': {
      if (field === 'name') return String(workspace.name || '');
      if (field === 'id') return String(workspace.id || '');
      return String(workspace.id || workspace.name || '');
    }

    case 'sequence': {
      if (field === 'name') return String(sequence.name || '');
      if (field === 'id') return String(sequence.id || '');
      return String(sequence.name || sequence.id || '');
    }

    case 'execution': {
      if (field === 'id') return String(execution.id || '');
      if (field === 'currentStep') return String(execution.currentStep ?? '');
      if (field === 'startedAt') return String(execution.startedAt || '');
      return '';
    }

    case 'sender': {
      if (field === 'name') return String(sender.name || '');
      if (field === 'email') return String(sender.email || '');
      return String(sender.name || sender.email || '');
    }

    case 'variables': {
      if (field.includes('.')) {
        const parts = field.split('.');
        let cur: any = variables;
        for (const p of parts) {
          if (cur === null || cur === undefined) return '';
          cur = cur[p];
        }
        return cur !== undefined && cur !== null ? String(cur) : '';
      }
      const val = variables[field];
      return val !== undefined && val !== null ? String(val) : '';
    }

    case 'today':
      return new Date().toISOString().split('T')[0] ?? '';

    case 'now':
      return new Date().toISOString();

    default: {
      // Legacy un-namespaced alias mappings
      const legacyMap: Record<string, () => string> = {
        firstName: () => String(contact.firstName || ''),
        lastName: () => String(contact.lastName || ''),
        fullName: () => `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        email: () => String(contact.email || ''),
        phone: () => String(contact.phone || ''),
        title: () => String(contact.title || ''),
        company: () => String(company.name || ''),
        website: () => String(company.domain || company.website || ''),
        domain: () => String(company.domain || company.website || ''),
        industry: () => String(company.industry || ''),
        location: () => String(company.location || ''),
        senderName: () => String(sender.name || 'Sales Director'),
        workspaceName: () => String(workspace.name || 'Workspace CRM'),
        sequence: () => String(sequence.name || ''),
        today: () => new Date().toISOString().split('T')[0] ?? '',
        now: () => new Date().toISOString()
      };

      if (trimmed in legacyMap) {
        return legacyMap[trimmed]!();
      }

      if (variables && trimmed in variables) {
        const val = variables[trimmed];
        return val !== undefined && val !== null ? String(val) : '';
      }

      return '';
    }
  }
}

/**
 * Replaces all `{{token}}` occurrences in a template string using the CanonicalVariableContext.
 */
export function renderCanonicalVariables(
  template: string | null | undefined,
  ctx: CanonicalVariableContext
): string {
  if (template === null || template === undefined) return '';
  if (typeof template !== 'string') return String(template);

  return template.replace(/\{\{([^}]+)\}\}/g, (_m, rawToken: string) => {
    return resolveTokenPath(rawToken, ctx);
  });
}

/**
 * Extracts unique variable tokens found in a template string.
 */
export function extractTemplateVariables(template: string | null | undefined): string[] {
  if (!template || typeof template !== 'string') return [];
  const matches = template.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  const set = new Set<string>();
  for (const m of matches) {
    const raw = m.slice(2, -2).trim();
    if (raw) set.add(raw);
  }
  return Array.from(set);
}

/**
 * Converts a plain-text email body (with \n line breaks) into safe HTML suitable
 * for rendering in email clients (Gmail, Outlook, Apple Mail).
 *
 * Conversion rules (applied in order):
 *  1. HTML-escape all special characters (&, <, >, ", ') to prevent XSS/injection.
 *  2. Collapse \r\n to \n for consistent handling.
 *  3. Split on double newlines (\n\n) to create paragraph blocks.
 *  4. Within each paragraph, convert single \n to <br/>.
 *  5. Wrap each paragraph in <p style="margin:0 0 16px 0;line-height:1.5;">.
 *
 * @param text - Raw plain-text string (as stored in SQLite template body).
 * @returns Safe HTML string ready for use in a MIME text/html part.
 */
export function plainTextToHtml(text: string): string {
  if (!text) return '';

  // 1. Escape HTML entities
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // 2. Normalise line endings
  const normalised = escaped.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Split into paragraphs on blank lines (two or more consecutive newlines)
  const paragraphs = normalised.split(/\n{2,}/);

  // 4 & 5. Within each paragraph, convert single \n to <br/> and wrap
  const htmlParagraphs = paragraphs.map((para) => {
    const withBreaks = para.replace(/\n/g, '<br/>');
    return `<p style="margin:0 0 16px 0;line-height:1.5;">${withBreaks}</p>`;
  });

  return htmlParagraphs.join('\n');
}

/**
 * Formats a plain-text email body into both text/plain and text/html MIME parts.
 *
 * Use this at the send boundary (worker plugins and API layer) so that:
 * - `text` is passed as the MIME text/plain part (preserves \n for plain-text clients).
 * - `html` is passed as the MIME text/html part (correct paragraph/line break rendering).
 *
 * @param body - Raw plain-text string as stored in SQLite.
 * @returns Object with `text` (unchanged) and `html` (safe HTML conversion).
 */
export function formatEmailBody(body: string): { text: string; html: string } {
  return {
    text: body,
    html: plainTextToHtml(body)
  };
}
