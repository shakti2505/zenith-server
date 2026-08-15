# Industrial AI Copilot Backend

A Node.js backend server built with **Fastify**, **TypeScript**, **Mongoose** (MongoDB), and **LiveKit Server SDK** for real-time video/audio and vision AI copilot capabilities in industrial environments.

## 🚀 Key Features

- **Fastify Web Framework**: High-performance HTTP server registered with `@fastify/cors` and `@fastify/env` schema validation.
- **MongoDB & Mongoose Integration**:
  - **`WorkOrder` Schema**: Tracks worker assignments, completion statuses, priority levels, and step breakdown.
  - **`Telemetry` Schema**: MongoDB **Time Series** collection for logging AI confidence scores (0.0–1.0) and latency metrics (ms).
  - **`KnowledgeChunk` Schema**: Stores textual documentation, asset IDs, and 1536-dimensional embeddings prepared for **MongoDB Atlas Vector Search**.
- **LiveKit RTC Integration**: Endpoint `GET /api/rtc/token` generating signed participant tokens using `livekit-server-sdk`.
- **Vision AI Service Placeholder**: `ai.service.ts` structured for LangChain and vision LLMs (Gemini / OpenAI) to process base64 image frames.
- **Modular Domain Architecture**: Organized into clean feature modules (`work-order`, `telemetry`, `knowledge`, `rtc`, `ai-chat`).

---

## 📁 Project Structure

```
copilot-server/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── src/
    ├── server.ts                    # Server bootstrap & entry point
    ├── app.ts                       # Fastify application setup & plugin configuration
    ├── config/
    │   ├── env.ts                   # Environment variable validation schema
    │   └── database.ts              # Mongoose MongoDB connection handler
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
    │   ├── rtc/
    │   │   ├── rtc.service.ts       # LiveKit token generator (livekit-server-sdk)
    │   │   └── rtc.routes.ts        # GET /api/rtc/token endpoint
    │   └── ai-chat/
    │       ├── ai.service.ts        # Multimodal Vision AI processing service
    │       └── ai-chat.routes.ts    # HTTP endpoints under /api/ai-chat
    └── types/
        └── fastify.d.ts             # Fastify instance interface extensions
```

---

## 🛠️ API Reference

### RTC LiveKit Endpoint
- `GET /api/rtc/token?room_name=factory-floor-1&participant_name=worker-john`
  - Returns signed LiveKit JWT token and server WebSocket connection URL.

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

### 3. Build & Run
```bash
# Development (with hot reloading via tsx)
npm run dev

# Build TypeScript to JavaScript
npm run build

# Start Production Server
npm start
```
