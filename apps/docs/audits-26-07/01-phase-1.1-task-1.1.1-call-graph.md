# Forensic Audit: Task 1.1.1 — Runtime Call Graphs

This document presents the detailed architectural call graphs for the manual automation execution path, decomposed into distinct sub-graphs for each architectural layer.

---

## 1. End-to-End Overview Call Graph

```mermaid
flowchart TD
    subgraph RENDERER["1. Renderer Process (React UI)"]
        UI["AutomationScreen.tsx\n(handleManualTrigger)"] --> HOOK["use-automation.ts\n(useStartSequence hook)"]
        HOOK --> REPO["sync.ts\n(SyncSequenceExecutionRepository.create)"]
        REPO --> BRIDGE["window.ipc.invoke('sequence:start')"]
    end

    subgraph PRELOAD["2. Preload Guard"]
        BRIDGE --> PRELOAD_SCRIPT["preload/index.ts\n(ipcRenderer.invoke)"]
    end

    subgraph MAIN["3. Desktop Main Process"]
        PRELOAD_SCRIPT --> IPC_HANDLER["main/ipc/automation.ts\n('sequence:start' handler)"]
        IPC_HANDLER --> WS_MGR["workspace-manager.ts\n(getActiveRuntime)"]
        IPC_HANDLER --> SDK_EXEC["@leadforge/sdk\n(sdk.executions.start)"]
        IPC_HANDLER -.-> LOCAL_CACHE["local-crm.ts\n(LocalCRMRepository.save to SQLite)"]
    end

    subgraph SDK["4. Shared SDK"]
        SDK_EXEC --> SDK_MOD["modules/automation.ts\n(ExecutionsModule.start)"]
        SDK_MOD --> SDK_HTTP["http/client.ts\n(HttpClient.post)"]
    end

    subgraph HTTP["5. Network Transport"]
        SDK_HTTP -->|HTTP POST /automation/executions/start| API_ENDPOINT
    end

    subgraph API["6. API Backend Server"]
        API_ENDPOINT["routes/automation.ts\n(POST /executions/start)"] --> API_SVC["automation.service.ts\n(AutomationService.startExecution)"]
        API_SVC --> MODEL_SEQ["sequence.model.ts\n(SequenceModel.findOne)"]
        API_SVC --> MODEL_EXEC["sequence-execution.model.ts\n(new SequenceExecutionModel)"]
        API_SVC --> API_LOG["automation.service.ts\n(logStep)"]
        API_LOG --> MODEL_LOG["sequence-log.model.ts\n(new SequenceLogModel)"]
    end

    subgraph MONGO["7. Central Database"]
        MODEL_EXEC -->|exec.save()| MONGO_EXEC[("MongoDB Collection\nsequence_executions")]
        MODEL_LOG -->|log.save()| MONGO_LOG[("MongoDB Collection\nsequence_logs")]
    end
```

---

## 2. Renderer Layer Call Graph

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as AutomationScreen.tsx
    participant Hook as useStartSequence (use-automation.ts)
    participant Repo as SyncSequenceExecutionRepository (sync.ts)
    participant Base as BaseSyncRepository (sync.ts)
    participant IPC as window.ipc

    User->>UI: Clicks "Run" button on sequence card
    UI->>UI: Prompt for optional contactId
    UI->>Hook: startSequenceMutation.mutate({ sequenceId, contactId, companyId: null })
    Hook->>Repo: SyncSequenceExecutionRepository.create({ sequenceId, contactId, companyId, workspaceId })
    Repo->>Base: BaseSyncRepository.create(record)
    Note over Base: Looks up DOMAIN_CHANNELS['sequence_executions'].create ('sequence:start')
    Base->>Base: Generates ID if missing (crypto.randomUUID())
    Base->>IPC: invoke('sequence:start', record)
```

---

## 3. IPC & Main Process Call Graph

```mermaid
sequenceDiagram
    autonumber
    participant Renderer as Renderer window.ipc
    participant Preload as preload/index.ts
    participant MainIPC as main/ipc/automation.ts
    participant WsMgr as WorkspaceManager
    participant SDK as SdkClient
    participant LocalDB as LocalCRMRepository (SQLite)

    Renderer->>Preload: invoke('sequence:start', payload)
    Note over Preload: Validates 'sequence:start' in validChannels array
    Preload->>MainIPC: ipcRenderer.invoke('sequence:start', payload)
    MainIPC->>WsMgr: getActiveRuntime()
    WsMgr-->>MainIPC: activeRuntime ({ workspaceId })
    MainIPC->>SDK: sdk.executions.start(sequenceId, contactId, companyId)
    SDK-->>MainIPC: Execution response object (res)
    MainIPC->>LocalDB: save('sequence_executions', { ...res, workspaceId }, true)
    Note over LocalDB: SQLite INSERT OR REPLACE into sequence_executions
    MainIPC-->>Preload: Returns execution object (res)
    Preload-->>Renderer: Resolves Promise with execution object
```

---

## 4. SDK Layer Call Graph

```mermaid
sequenceDiagram
    autonumber
    participant MainIPC as Electron Main IPC Handler
    participant SdkClient as SdkClient
    participant ExecModule as ExecutionsModule (sdk/modules/automation.ts)
    participant Http as HttpClient (sdk/http/client.ts)
    participant Network as Fetch API Network Transport

    MainIPC->>SdkClient: sdk.executions.start(sequenceId, contactId, companyId)
    SdkClient->>ExecModule: start(sequenceId, contactId, companyId)
    ExecModule->>Http: post('/automation/executions/start', { sequenceId, contactId, companyId })
    Http->>Http: Inject Authorization: Bearer token & Content-Type: application/json
    Http->>Http: JSON.stringify(body)
    Http->>Network: fetch(url, requestOptions)
    Network-->>Http: Response object (HTTP 200)
    Http->>Http: response.json() -> ApiResponse<SequenceExecution>
    Http-->>ExecModule: payload.data
    ExecModule-->>SdkClient: SequenceExecution object
    SdkClient-->>MainIPC: SequenceExecution object
```

---

## 5. API Server Layer Call Graph

```mermaid
sequenceDiagram
    autonumber
    participant Transport as HTTP Request (POST /automation/executions/start)
    participant Router as routes/automation.ts
    participant Service as AutomationService (automation.service.ts)
    participant SeqModel as SequenceModel
    participant ExecModel as SequenceExecutionModel
    participant LogModel as SequenceLogModel

    Transport->>Router: POST /executions/start (Body: { sequenceId, contactId, companyId })
    Router->>Router: getWorkspaceId(c) -> extracts workspaceId
    Router->>Router: c.req.json() -> parses body
    Router->>Service: new AutomationService(wsId)
    Router->>Service: startExecution(body.sequenceId, body)
    Service->>SeqModel: findOne({ _id: sequenceId, workspaceId })
    SeqModel-->>Service: Sequence document
    Service->>ExecModel: findOne({ workspaceId, sequenceId, status: { $in: [...] }, contactId, companyId })
    ExecModel-->>Service: null (no active duplicate)
    Service->>ExecModel: new SequenceExecutionModel({ _id, sequenceId, workspaceId, contactId, companyId, status: "PENDING", currentStep: 0, startedAt: Date.now() })
    Service->>ExecModel: exec.save()
    Service->>Service: logStep(exec._id, 0, "TRIGGER", "SUCCESS", "Sequence manually triggered.")
    Service->>LogModel: new SequenceLogModel({ workspaceId, executionId, step: 0, action: "TRIGGER", status: "SUCCESS", message: "..." }).save()
    Service->>ExecModel: findByIdAndUpdate(executionId, { $push: { logs: ... } })
    Service-->>Router: Returns exec Mongoose document
    Router-->>Transport: Returns c.json(successResponse(exec))
```

---

## 6. Database Persistence Call Graph

```mermaid
flowchart LR
    subgraph API_SVC["AutomationService.startExecution()"]
        STEP1["1. Instantiates new SequenceExecutionModel"]
        STEP2["2. Instantiates new SequenceLogModel"]
        STEP3["3. Updates SequenceExecutionModel logs array"]
    end

    subgraph MONGO["MongoDB Database Engine"]
        COLL_EXEC[("sequence_executions\nCollection")]
        COLL_LOG[("sequence_logs\nCollection")]
    end

    subgraph SQLITE["Desktop Local SQLite Engine"]
        TABLE_EXEC[("sequence_executions\nSQLite Table")]
    end

    STEP1 -->|exec.save()| COLL_EXEC
    STEP2 -->|log.save()| COLL_LOG
    STEP3 -->|findByIdAndUpdate $push| COLL_EXEC
    
    API_SVC -.->|Response returned to Desktop Main Process| MAIN_SAVE["LocalCRMRepository.save()"]
    MAIN_SAVE -->|INSERT OR REPLACE| TABLE_EXEC
```
