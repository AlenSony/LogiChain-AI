# LogiChain AI: Advanced Multi-Agent Autonomous Logistics System

LogiChain AI is a next-generation enterprise logistics and supply chain management platform. Unlike traditional systems that merely log static "Source → Destination" shipping records, LogiChain AI treats logistics as a dynamic graph optimization problem.

Featuring a core multi-agent AI layer built on **LangGraph**, the system autonomously manages routing, dynamically distributes warehouse loads, schedules employee pick-ups/deliveries, and monitors security compliance in real time.

---

## 🚀 Key Features

* **Dynamic Multi-Hub Routing:** Packages move organically through a sequence of transit hubs (`Source` → `Warehouse A` → `Warehouse B` → `Destination`) optimized dynamically by AI.
* **5-Agent Autonomous Swarm:** Orchestrated via LangGraph to handle everything from perimeter security and intent classification to complex graph-based routing adjustments.
* **Advanced Pathfinding Algorithms:** Custom-weighted $A^*$ Search or Dijkstra implementations accounting for physical distance, traffic constraints, real-time warehouse capacities, and vehicle availability.
* **Enterprise-Grade Tracking:** Complete custody-chain logging via QR Code scanning tracking events, real-time GPS streaming, and cryptographic/photographic Proof of Delivery (PoD).
* **Production-Ready Architecture:** Next.js frontend with HttpOnly JWT auth, backed by a high-performance distributed architecture using FastAPI, PostgreSQL, Celery, and Redis.

---

## 🏗️ System Architecture

```
                       ┌───────────────────────┐
                       │   Next.js Frontend    │
                       └───────────┬───────────┘
                                   │ Supabase Client (Browser/Server)
                                   ▼
                       ┌───────────────────────┐
                       │   Supabase Backend    │
                       │ (Auth, PostgREST API) │
                       └─────┬───────────┬─────┘
                             │           │
           ┌─────────────────┘           └─────────────────┐
           ▼                                               ▼
┌─────────────────────┐                         ┌─────────────────────┐
│  PostgreSQL DB      │                         │  Edge Functions     │
│  (Data & Ledger)    │                         │  (Background Jobs)  │
└─────────────────────┘                         └──────────┬──────────┘
                                                           │
                                                           ▼
                                                ┌─────────────────────┐
                                                │   LangGraph AI Swarm│
                                                └─────────────────────┘
```

### AI Agent Workflow Engine

```
             User Query
                 │
                 ▼
       [ 1. Security Agent ] ──(Violation)──► [ Access Denied ]
                 │
         (Passed Validation)
                 │
                 ▼
      [ 2. Intent Classifier ]
                 │
   ┌─────────────┼──────────────┐
   ▼             ▼              ▼
[ Order ]   [ Routing ]   [ Warehouse ]
 Agent        Agent         Agent
   │             │              │
   └─────────────┼──────────────┘
                 │
                 ▼
       [ 5. Delivery Agent ]
                 │
                 ▼
         Optimized Response

```

---

## Directory Structure

logichain-ai/
├── backend/
│   ├── app/
│   │   ├── api/                    # API Endpoints (Versioned)
│   │   │   ├── v1/
│   │   │   │   ├── auth.py         # JWT & Cookie-based Auth handlers
│   │   │   │   ├── employees.py    # Employee & Fleet tracking
│   │   │   │   ├── packages.py     # Package CRUD & Status transitions
│   │   │   │   └── routing.py      # Triggering manual/AI routing steps
│   │   │   └── deps.py             # FastAPI Dependencies (get_db, get_current_user)
│   │   │
│   │   ├── core/                   # System Configuration & Security
│   │   │   ├── config.py           # Pydantic BaseSettings (Env loader)
│   │   │   ├── database.py         # SQLAlchemy Async Engine & Session local
│   │   │   └── security.py         # Password hashing, JWT encode/decode
│   │   │
│   │   ├── models/                 # SQLAlchemy ORM Data Models
│   │   │   ├── base.py             # Shared Base declarative class
│   │   │   ├── package.py          # Packages & PackageRoutes models
│   │   │   ├── tracking.py         # TrackingEvents & PackageLocation
│   │   │   └── user.py             # Users & Employees models
│   │   │
│   │   ├── schemas/                # Pydantic Validation Handlers
│   │   │   ├── auth.py
│   │   │   ├── package.py
│   │   │   └── user.py
│   │   │
│   │   ├── services/               # Core Logistical Algorithms
│   │   │   ├── pathfinding.py      # Dijkstra & A* Search implementations
│   │   │   └── qr_engine.py        # QR Code generator & signature validator
│   │   │
│   │   ├── workers/                # Distributed Task Engine
│   │   │   ├── celery_app.py       # Celery configuration & Redis binding
│   │   │   └── tasks.py            # Async notification / PDF generation tasks
│   │   │
│   │   └── main.py                 # FastAPI Application entry point
│   │
│   ├── agents/                     # LangGraph Multi-Agent Layer
│   │   ├── state.py                # Agent State definitions (Graph memory)
│   │   ├── graph.py                # LangGraph Workflow Construction & Compiling
│   │   ├── tools/                  # LLM Action Executions (DB / Route Tool bindings)
│   │   │   ├── routing_tools.py
│   │   │   └── warehouse_tools.py
│   │   └── nodes/                  # Individual Swarm Agent Prompts & Logics
│   │       ├── security_agent.py
│   │       ├── intent_classifier.py
│   │       ├── order_agent.py
│   │       ├── routing_agent.py
│   │       └── warehouse_agent.py
│   │
│   ├── alembic/                    # Database Schema Migrations folder
│   │   ├── versions/
│   │   └── env.py
│   │
│   ├── .env.example
│   ├── alembic.ini
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── app/                    # Next.js App Router Pages
│   │   │   ├── (auth)/             # Auth Route Group (Login/Register)
│   │   │   │   └── login/
│   │   │   ├── dashboard/          # Shared Layout
│   │   │   │   ├── admin/          # Admin Control Tower views
│   │   │   │   ├── customer/       # Customer Booking & Tracking views
│   │   │   │   ├── driver/         # Mobile-responsive QR Scanner & Proof-of-delivery
│   │   │   │   └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx            # Landing Page
│   │   │
│   │   ├── components/             # Reusable UI Architecture
│   │   │   ├── maps/               # Leaflet Map Wrapper (Dynamic route plotting)
│   │   │   ├── ui/                 # Shadcn primitives (Buttons, Cards, Modals)
│   │   │   └── qr/                 # QR Code Scanner & Reader interfaces
│   │   │
│   │   ├── hooks/                  # Global Custom React Hooks
│   │   │   └── useAuth.ts          # Auth state monitor
│   │   │
│   │   ├── lib/                    # Configuration Instances
│   │   │   └── api-client.ts       # Axios wrapper with credentials config
│   │   │
│   │   ├── services/               # React Query / Data Mutation hooks
│   │   │   ├── queries.ts          # GET requests (tracking, analytics)
│   │   │   └── mutations.ts        # POST/PUT requests (shipment creation, scanning)
│   │   │
│   │   └── types/                  # Shared TypeScript Structural Definitions
│   │       └── index.ts
│   │
│   ├── public/                     # Static Asserts (logos, sounds)
│   ├── .env.local
│   ├── next.config.js
│   ├── package.json
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── docker-compose.yml              # Provisions Postgres, Redis, and App cluster
└── README.md

## 🛠️ Tech Stack

| Layer | Technology | Description |
| --- | --- | --- |
| **Frontend** | Next.js 16 (App Router), TypeScript, Tailwind CSS | Responsive dashboard, real-time map interfaces, and telemetry using Minimalist White & Jade Green system. |
| **Mapping** | Leaflet Maps, OpenStreetMap, OSRM / GraphHopper | Geographical rendering, path plotting, and spatial distance lookup. |
| **Backend API** | Supabase (PostgREST) | Auto-generated REST API directly mapped from PostgreSQL schema. |
| **Authentication** | Supabase Auth (GoTrue) | JWT inside `HttpOnly` Secure Cookies via Next.js middleware and proxy. |
| **Task Queue** | Supabase Edge Functions | Distributed asynchronous processing for notifications and AI workflows. |
| **Database** | PostgreSQL | Relational transactional ledger preserving data consistency across multi-hub legs. |
| **AI Orchestration** | LangGraph, LangChain, OpenAI API / Ollama | Directed cyclic/acyclic graph execution of agent actions and state management. |

---

## 🤖 The Multi-Agent Swarm

### 1. Security Agent

Acts as an application-level firewall. It inspects incoming natural language payloads before they reach downstream logic.

* **Responsibilities:** Detects prompt injection attempts, performs strict role-based access validation, and filters unauthorized structural queries (e.g., a customer prompting *"Show me all packages in the system"*).

### 2. Order Management Agent

Handles explicit context regarding individual package states and internal enterprise business rules.

* **Responsibilities:** Evaluates policy conditions. If a user asks to cancel an order, it fetches the tracking ledger; if the package is already state-marked as `in_transit`, it gracefully rejects the cancellation.

### 3. Routing Agent

The core computational engine that compiles multi-hub journey sequences.

* **Input:** Source, Destination, Package Dimensions/Weight.
* **Computation:** Queries network graphs to analyze physical distances, current traffic metrics, target warehouse loads, and asset/vehicle availability.
* **Output:** Generates optimized sequence points (`Warehouse A` $\rightarrow$ `Warehouse B`) accompanied by deterministic ETAs.

### 4. Warehouse Optimization Agent

Monitors system-wide storage constraints to prevent systemic delivery bottlenecks.

* **Responsibilities:** Actively samples warehouse capacity. If a node approaches critical capacity ($\ge 90\%$), it dynamically alerts the *Routing Agent* to calculate alternative bypass nodes (e.g., rerouting a Kochi-bound flow via a Coimbatore hub instead).

### 5. Delivery Scheduling Agent

Automates manual dispatcher assignments by matching logistical supply with customer demand.

* **Responsibilities:** Binds available `pickup_employee` or `delivery_employee` assets to optimal time windows and high-capacity delivery vehicles automatically upon state updates.

---

## 📊 Database Schema Design

### Core User & Asset Infrastructure

#### `users`

Tracks systemic actors across the platform.

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL, -- 'customer', 'admin', 'warehouse_manager', 'pickup_employee', 'delivery_employee'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

```

#### `employees`

Extends user records with operational fleet context.

```sql
CREATE TABLE employees (
    employee_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    employee_type VARCHAR(50) NOT NULL, -- 'pickup_agent', 'warehouse_operator', 'delivery_agent', 'route_manager'
    warehouse_id INT, -- Nullable if roaming
    vehicle_id INT,
    status VARCHAR(50) NOT NULL,
    joined_date DATE NOT NULL
);

```

#### `warehouses`

Defines operational physical graph nodes.

```sql
CREATE TABLE warehouses (
    warehouse_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    capacity INT NOT NULL,
    current_load INT DEFAULT 0
);

```

### Package & Multi-Hub Routing Ledger

#### `packages`

```sql
CREATE TABLE packages (
    package_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    tracking_number VARCHAR(100) UNIQUE NOT NULL,
    weight DECIMAL(10,2),
    length DECIMAL(10,2),
    width DECIMAL(10,2),
    height DECIMAL(10,2),
    category VARCHAR(100),
    fragile BOOLEAN DEFAULT FALSE,
    hazardous BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) NOT NULL, -- 'pending', 'pickup_scheduled', 'picked_up', 'in_warehouse', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'
    source_address TEXT NOT NULL,
    destination_address TEXT NOT NULL,
    pickup_date TIMESTAMP,
    delivery_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

```

#### `package_routes`

The dynamic routing manifest mapping packages across multiple physical nodes.

```sql
CREATE TABLE package_routes (
    id SERIAL PRIMARY KEY,
    package_id INT REFERENCES packages(package_id) ON DELETE CASCADE,
    warehouse_id INT REFERENCES warehouses(warehouse_id),
    sequence_no INT NOT NULL, -- Order of movement: 1, 2, 3...
    arrival_time TIMESTAMP,
    departure_time TIMESTAMP
);

```

### Operations & Telemetry

#### `tracking_events`

The immutable chronological audit log of physical custody transfers.

```sql
CREATE TABLE tracking_events (
    event_id SERIAL PRIMARY KEY,
    package_id INT REFERENCES packages(package_id),
    warehouse_id INT REFERENCES warehouses(warehouse_id),
    employee_id INT REFERENCES employees(employee_id),
    status VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT
);

```

#### `package_location`

Stores ephemeral high-frequency live GPS coordinate updates.

```sql
CREATE TABLE package_location (
    package_id INT REFERENCES packages(package_id) ON DELETE CASCADE,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (package_id, timestamp)
);

```

---

## 🧮 Routing Algorithm Formulations

LogiChain AI features a dual-mode routing architecture selectable depending on the deployment scale:

### 1. Classical Distance Optimization (Dijkstra)

Graph nodes are treated as strict static coordinate vertices. Cost optimization is calculated exclusively as a factor of physical distance over safe roadway edges:

$$Cost = \sum_{i=1}^{n} \text{Distance}(Edge_i)$$

### 2. Multi-Variable Predictive Pathfinding ($A^*$ Search)

The advanced routing agent calculates real-time paths by applying dynamic programmatic weights to network edges:

$$Cost = w_1 \cdot \text{Distance} + w_2 \cdot \text{Traffic Delay} + w_3 \cdot \text{Node Occupancy Ratio} + w_4 \cdot \text{Vehicle Availability}$$

Where:

* $\text{Node Occupancy Ratio} = \frac{\text{Current Load}}{\text{Total Capacity}}$
* If a warehouse node's capacity ratio hits a threshold $> 0.9$, its operational weight scales non-linearly to force the $A^*$ calculation onto alternative sub-graphs.

---

## 🛠️ Installation & Setup

### Prerequisites

* Docker & Docker Compose (for Supabase Local Dev)
* Node.js v18+
* OpenAI API Key

### Configuration & Setup

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/logichain-ai.git
cd logichain-ai
```

2. **Initialize Supabase Local Database:**
```bash
cd backend
npx supabase start
```
This will automatically spin up PostgreSQL, GoTrue, and all Supabase services, and apply the initial schema and RLS migrations.

3. **Initialize Frontend Application:**
Configure the `.env.local` file inside the `frontend` directory using the output from the `supabase start` command (e.g. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

```bash
cd ../frontend
npm install
npm run dev
```

The Customer Dashboard will now be available at `http://localhost:3000`.
---

## 🔒 Security & Verification Workflows

> 💡 **Enterprise Handshake Design:** > When packages transition between physical status points (e.g., from `in_warehouse` to `out_for_delivery`), operators must execute a signed cryptographic or visual scan sequence.

* **QR Ledger Manifest:** Every unique `package_id` maps to an encrypted QR block. Scanning the code passes a verification signature payload containing `(package_id, operator_id, timestamp)` directly to the API, preventing manual data entry fraud.
* **Proof of Delivery (PoD):** The closure state (`delivered`) cannot be toggled manually. It requires a multipart upload payload via the mobile-responsive frontend comprising a client digital signature blob, a timestamped delivery photograph, and geographic geofencing coordinates matching the package's destination address.