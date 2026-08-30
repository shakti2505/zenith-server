# Industrial AI Copilot Backend

A horizontally scalable Node.js backend built with **Fastify**, **Socket.IO** (`@socket.io/redis-adapter`), **Redis**, **BullMQ**, and **Mongoose** (MongoDB) for low-latency AI vision processing in industrial environments.

---

## 🚀 Key Architecture & Features

- **Stateless Fastify Gateway**: High-performance HTTP & WebSocket server registered with `@fastify/cors`, `@fastify/env`, and `@socket.io/redis-adapter` for horizontal multi-instance scaling.
- **Decoupled BullMQ Vision Queue (`ai-vision-queue`)**: When clients emit binary video frames (`process_frame`), the gateway pushes jobs to BullMQ immediately without blocking the Node.js event loop.
- **Independent Vision Worker Cluster**: BullMQ workers pull from `ai-vision-queue`, run Gemini 1.5 Flash multimodal vision analysis, and use `@socket.io/redis-emitter` to broadcast the structured result directly to the originating `socket.id`.
- **MongoDB & Mongoose Integration**:
  - **`WorkOrder` Schema**: Tracks worker assignments, completion statuses, priority levels, and step breakdown.
  - **`Telemetry` Schema**: MongoDB Time Series collection for logging AI confidence scores (0.0–1.0) and latency metrics (ms).
  - **`KnowledgeChunk` Schema**: Stores textual documentation, asset IDs, and 1536-dimensional embeddings prepared for **MongoDB Atlas Vector Search**.
- **Modular Domain Architecture**: Organized into clean feature modules (`work-order`, `telemetry`, `knowledge`, `ai-chat`).

---

## 📁 Project Structure

```
zenith-server/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── src/
    ├── server.ts                    # Gateway process entrypoint (HTTP + Socket.IO)
    ├── worker.ts                    # Standalone BullMQ Worker process entrypoint
    ├── app.ts                       # Fastify application setup & plugin configuration
    ├── config/
    │   ├── env.ts                   # Environment variable validation schema
    │   ├── redis.ts                 # Shared Redis connection factory (Adapter, BullMQ, Emitter)
    │   └── database.ts              # Mongoose MongoDB connection handler
    ├── queues/
    │   ├── queue.config.ts          # Queue names & default job retention policies
    │   └── vision.queue.ts          # BullMQ 'ai-vision-queue' producer & enqueue helper
    ├── workers/
    │   └── vision.worker.ts         # BullMQ Worker processor + Gemini mock + Redis Emitter
    ├── sockets/
    │   ├── socket.config.ts         # Socket.IO options, event constants & payload interfaces
    │   └── socket.gateway.ts        # Socket.IO Gateway with Redis Adapter & 'process_frame' handler
    ├── types/
    │   ├── fastify.d.ts             # Fastify instance interface extensions
    │   └── vision.types.ts          # Strictly typed schemas for frames, jobs, and results
    ├── modules/
    │   ├── work-order/
    │   │   ├── work-order.model.ts  # WorkOrder Mongoose Schema
    │   │   ├── work-order.service.ts# WorkOrder Business Logic
    │   │   └── work-order.routes.ts # HTTP endpoints under /api/work-orders
    │   ├── telemetry/
    │   │   ├── telemetry.model.ts   # Time Series Telemetry Mongoose Schema
    │   │   ├── telemetry.service.ts # Telemetry aggregation & logging
    │   │   └── telemetry.routes.ts  # HTTP endpoints under /api/telemetry
    │   ├── knowledge/
    │   │   ├── knowledge.model.ts   # Vector Search KnowledgeChunk Schema (1536-dim)
    │   │   ├── knowledge.service.ts # Knowledge CRUD & vector search
    │   │   └── knowledge.routes.ts  # HTTP endpoints under /api/knowledge
    │   └── ai-chat/
    │       ├── ai.service.ts        # Multimodal Vision AI processing service
    │       └── ai-chat.routes.ts    # HTTP endpoints under /api/ai-chat
    ├── plugins/
    │   └── requestLogger.ts         # Industrial colored console logger
    └── utils/
        ├── AppError.ts              # Application error classes
        ├── errorHandler.ts          # Global error handler
        └── response.util.ts         # Standard response formatters
```

---

## ⚡ WebSocket Events Reference

### Client -> Gateway
- `process_frame`: Emits raw binary `ArrayBuffer` or `{ frame: ArrayBuffer, workOrderId?: string, stepNumber?: number }`.
- `join_stream`: Join a work order room (`{ workOrderId: string, role: 'publisher' | 'subscriber', workerName?: string }`).
- `video_frame`: Real-time relay frame for supervisor dashboard.
- `leave_stream`: Leave stream room.

### Worker / Gateway -> Client
- `frame_queued`: Immediate acknowledgment emitted by Gateway with `{ jobId: string, status: 'QUEUED', queue: 'ai-vision-queue' }`.
- `frame_processed`: Dispatched by background BullMQ worker via `@socket.io/redis-emitter` directly to `socket.id`:
  ```json
  {
    "status": "COMPLETED",
    "feedback_hinglish": "Done, agla step karo.",
    "jobId": "123",
    "confidence": 0.96,
    "processingTimeMs": 412,
    "timestamp": "2026-08-29T07:45:00.000Z"
  }
  ```

---

## 🛠️ API Reference

### Work Orders (`/api/work-orders`)
- `GET /api/work-orders`: List all work orders (optional query filters: `status`, `assignedWorkerId`, `assetId`).
- `POST /api/work-orders`: Create a new work order with steps.
- `GET /api/work-orders/:id`: Get single work order details.
- `PATCH /api/work-orders/:id`: Update work order status or worker assignment.
- `POST /api/work-orders/:id/steps/:stepIndex`: Update step completion status and notes.

### Telemetry (`/api/telemetry`)
- `GET /api/telemetry`: Query time-series telemetry metrics.
- `GET /api/telemetry/stats`: Get aggregate metrics (average AI confidence score, average/min/max latency).
- `POST /api/telemetry`: Record telemetry entry manually.

### Knowledge Chunks & Vector Search (`/api/knowledge`)
- `POST /api/knowledge`: Create a new text chunk with a 1536-dimensional float embedding array.
- `GET /api/knowledge/asset/:assetId`: Fetch chunks associated with an asset.
- `POST /api/knowledge/vector-search`: Run Atlas `$vectorSearch` pipeline query using a 1536-dim embedding vector.

### AI Vision & Chat (`/api/ai-chat`)
- `POST /api/ai-chat/analyze-frame`: Process base64 camera image frame with vision AI and log telemetry automatically.
- `POST /api/ai-chat/embed`: Generate 1536-dimensional text vector embedding for RAG.

---

## 🚦 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Run Gateway & Worker

```bash
# Terminal 1: Start WebSocket Gateway (with hot-reload)
npm run dev:gateway

# Terminal 2: Start BullMQ AI Vision Worker (with hot-reload)
npm run dev:worker
```

### 4. Production Build & Start
```bash
# Build TypeScript
npm run build

# Start Gateway
npm run start:gateway

# Start Worker
npm run start:worker
```
