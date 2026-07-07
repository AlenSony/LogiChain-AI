# LogiChain AI: Advanced Multi-Agent Autonomous Logistics System

LogiChain AI is a next-generation enterprise logistics and supply chain management platform. Unlike traditional systems that merely log static "Source → Destination" shipping records, LogiChain AI treats logistics as a dynamic graph optimization problem.

Featuring a core multi-agent AI layer built on **LangGraph**, the system autonomously manages routing, dynamically distributes warehouse loads, schedules employee pick-ups/deliveries, and monitors security compliance in real time.

---

## 🚀 Key Features

* **Dynamic Multi-Hub Routing:** Packages move organically through a sequence of transit hubs (`Source` → `Warehouse A` → `Warehouse B` → `Destination`) optimized dynamically by AI.
* **5-Agent Autonomous Swarm:** Orchestrated via LangGraph to handle everything from perimeter security and intent classification to complex graph-based routing adjustments.
* **Advanced Pathfinding Algorithms:** Custom-weighted A\* Search or Dijkstra implementations accounting for physical distance, traffic constraints, real-time warehouse capacities, and vehicle availability.
* **Enterprise-Grade Tracking:** Complete custody-chain logging via QR Code scanning tracking events, real-time GPS streaming, and cryptographic/photographic Proof of Delivery (PoD).
* **Role-Based Access Control:** Strict RLS policies and middleware-enforced routing gateways isolating Admin, Customer, Warehouse Manager, and Driver portals.

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
│  PostgreSQL DB      │                         │  FastAPI + Agents   │
│  (Data & Ledger)    │                         │  (AI Orchestration) │
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

## 🛠️ Tech Stack

| Layer | Technology | Description |
| --- | --- | --- |
| **Frontend** | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 | Responsive role-based dashboards with minimalist White & Jade Green design system. |
| **Backend API** | Supabase (PostgREST) | Auto-generated REST API directly mapped from PostgreSQL schema with Row Level Security. |
| **Authentication** | Supabase Auth (GoTrue) | JWT-based auth with cookie handling via Next.js middleware proxy. |
| **Database** | PostgreSQL 15 (via Supabase) | Relational transactional ledger with custom ENUMs, triggers, and RLS policies. |
| **AI Orchestration** | LangGraph, LangChain, OpenAI API | Directed cyclic/acyclic graph execution of agent actions and state management. |
| **Backend Runtime** | FastAPI, Python 3.11+ | Agent hosting, custom API endpoints, and async processing. |

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
* **Output:** Generates optimized sequence points (`Warehouse A` → `Warehouse B`) accompanied by deterministic ETAs.

### 4. Warehouse Optimization Agent

Monitors system-wide storage constraints to prevent systemic delivery bottlenecks.

* **Responsibilities:** Actively samples warehouse capacity. If a node approaches critical capacity (≥ 90%), it dynamically alerts the *Routing Agent* to calculate alternative bypass nodes (e.g., rerouting a Kochi-bound flow via a Coimbatore hub instead).

### 5. Delivery Scheduling Agent

Automates manual dispatcher assignments by matching logistical supply with customer demand.

* **Responsibilities:** Binds available `pickup_employee` or `delivery_employee` assets to optimal time windows and high-capacity delivery vehicles automatically upon state updates.

---

## 📊 Database Schema

The PostgreSQL schema is managed through Supabase migrations and uses custom ENUMs for type safety:

### Custom Types

```sql
-- Role-based access control
CREATE TYPE user_role AS ENUM (
    'customer', 'admin', 'warehouse_manager',
    'pickup_employee', 'delivery_employee'
);

-- Employee classification
CREATE TYPE employee_type AS ENUM (
    'pickup_agent', 'warehouse_operator',
    'delivery_agent', 'route_manager'
);

-- Package lifecycle states
CREATE TYPE package_status AS ENUM (
    'pending', 'pickup_scheduled', 'picked_up', 'in_warehouse',
    'in_transit', 'out_for_delivery', 'delivered', 'cancelled'
);
```

### Core Tables

| Table | Purpose |
| --- | --- |
| `profiles` | Extends `auth.users` with name, role (via `user_role` ENUM), and contact info |
| `warehouses` | Physical graph nodes with geolocation, capacity, and real-time load tracking |
| `employees` | Fleet assets linked to profiles, assigned warehouses, and vehicles |
| `packages` | Core shipment records with dimensions, category, fragile/hazardous flags, and status |
| `package_routes` | AI-computed multi-hub journey sequences (`package_id` → `warehouse_id` × `sequence_no`) |
| `tracking_events` | Immutable custody-chain audit log of status transitions |
| `package_location` | High-frequency GPS coordinate stream (composite PK: `package_id` + `timestamp`) |

### Triggers & Automation

* **`handle_new_user()`** — Automatically creates a `profiles` row when a new user signs up via Supabase Auth, reading `name` and `role` from `raw_user_meta_data`.

### Row Level Security (RLS)

All tables have RLS enabled with scoped policies:

* Users can only read/update their own profile
* Customers can only view, insert, and update their own packages
* Authenticated users can view warehouse data
* Additional role-based policies planned for employees and tracking events

---

## 🧮 Routing Algorithm Formulations

LogiChain AI features a dual-mode routing architecture selectable depending on the deployment scale:

### 1. Classical Distance Optimization (Dijkstra)

Graph nodes are treated as strict static coordinate vertices. Cost optimization is calculated exclusively as a factor of physical distance over safe roadway edges:

$$Cost = \sum_{i=1}^{n} \text{Distance}(Edge_i)$$

### 2. Multi-Variable Predictive Pathfinding (A\* Search)

The advanced routing agent calculates real-time paths by applying dynamic programmatic weights to network edges:

$$Cost = w_1 \cdot \text{Distance} + w_2 \cdot \text{Traffic Delay} + w_3 \cdot \text{Node Occupancy Ratio} + w_4 \cdot \text{Vehicle Availability}$$

Where:

* $\text{Node Occupancy Ratio} = \frac{\text{Current Load}}{\text{Total Capacity}}$
* If a warehouse node's capacity ratio hits a threshold $> 0.9$, its operational weight scales non-linearly to force the A\* calculation onto alternative sub-graphs.

---

## 📁 Project Structure

```
logichain-ai/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/                     # Versioned API endpoints (planned)
│   │   │   ├── deps.py                 # FastAPI dependencies (auth, DB)
│   │   │   └── main.py                 # FastAPI app entry point
│   │   └── core/
│   │       ├── config.py               # Pydantic settings (env loader)
│   │       └── database.py             # Database connection setup
│   │
│   ├── agents/                         # LangGraph multi-agent layer
│   │   ├── graph.py                    # LangGraph workflow construction
│   │   ├── state.py                    # Agent state definitions
│   │   ├── tools/                      # LLM action tools (DB/route bindings)
│   │   └── nodes/                      # Individual agent prompts & logic
│   │
│   ├── supabase/
│   │   ├── migrations/
│   │   │   ├── 20260702_schema_definition.sql
│   │   │   ├── 20260705_enable_rls.sql
│   │   │   └── 20260707_fix_trigger.sql
│   │   ├── seed.sql                    # Mock data (5 users, warehouses, packages)
│   │   └── config.toml                 # Supabase local dev configuration
│   │
│   ├── .env
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/login/page.tsx   # Dual-mode auth (Sign In / Sign Up)
│   │   │   ├── dashboard/
│   │   │   │   ├── layout.tsx          # Global session & role interceptor shell
│   │   │   │   ├── page.tsx            # Auto-redirect to role-specific portal
│   │   │   │   ├── admin/page.tsx      # Admin control tower dashboard
│   │   │   │   ├── customer/page.tsx   # Customer package management portal
│   │   │   │   ├── driver/page.tsx     # Driver operations dashboard
│   │   │   │   └── warehouse_manager/page.tsx
│   │   │   ├── layout.tsx              # Root layout
│   │   │   ├── globals.css             # Design system (Jade & Slate)
│   │   │   └── page.tsx                # Landing page
│   │   │
│   │   ├── components/ui/
│   │   │   ├── NewPackageModal.tsx      # Package creation form modal
│   │   │   └── SignOutButton.tsx        # Auth sign-out component
│   │   │
│   │   ├── lib/supabase/
│   │   │   ├── client.ts               # Browser Supabase client
│   │   │   └── server.ts               # Server-side Supabase client
│   │   │
│   │   ├── types/
│   │   │   └── supabase.ts             # Generated database type definitions
│   │   │
│   │   └── proxy.ts                    # Next.js middleware (auth + RBAC routing)
│   │
│   ├── .env.local
│   ├── package.json
│   └── tsconfig.json
│
├── .gitignore
└── README.md
```

---

## 🛠️ Installation & Setup

### Prerequisites

* Docker & Docker Compose (for Supabase Local Dev)
* Node.js v18+
* Python 3.11+
* OpenAI API Key (for AI agent features)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/logichain-ai.git
cd logichain-ai
```

### 2. Start Supabase (Database + Auth)

```bash
cd backend
npx supabase start
```

This spins up PostgreSQL, GoTrue Auth, PostgREST, and all Supabase services. Migrations are applied automatically, creating the schema, RLS policies, and triggers.

To seed mock data (5 test users, warehouses, packages, routes, tracking events):

```bash
npx supabase db reset
```

### 3. Start the Frontend

Configure `frontend/.env.local` using the output from `supabase start`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Then:

```bash
cd ../frontend
npm install
npm run dev
```

The app is now available at `http://localhost:3000`.

### Test Credentials (Seeded Users)

| Email | Password | Role |
| --- | --- | --- |
| `admin@logichain.ai` | `password123` | Admin |
| `manager@logichain.ai` | `password123` | Warehouse Manager |
| `pickup@logichain.ai` | `password123` | Pickup Employee |
| `delivery@logichain.ai` | `password123` | Delivery Employee |
| `customer@enterprise.com` | `password123` | Customer |

---

## 📈 Development Progress

### ✅ Phase 1 — Foundation & Infrastructure
- [x] Project scaffolding (monorepo: backend + frontend)
- [x] Supabase local development environment
- [x] PostgreSQL schema with custom ENUMs (`user_role`, `employee_type`, `package_status`)
- [x] Core tables: `profiles`, `warehouses`, `employees`, `packages`, `package_routes`, `tracking_events`, `package_location`
- [x] Database trigger (`handle_new_user`) for automatic profile creation on signup
- [x] Realtime subscriptions enabled for `package_location`, `tracking_events`, `warehouses`

### ✅ Phase 2 — Authentication & Security
- [x] Supabase Auth (GoTrue) integration with JWT
- [x] Next.js middleware proxy for cookie-based session management
- [x] Dual-mode auth page (Sign In / Sign Up) with role selection
- [x] Row Level Security (RLS) policies on all tables
- [x] Schema-level grants for `anon` and `authenticated` roles

### ✅ Phase 3 — Role-Based Routing & Dashboards
- [x] Middleware-enforced RBAC routing (customers can't access admin, etc.)
- [x] Auto-redirect from `/dashboard` to role-specific portal
- [x] Server-side session & role verification in dashboard layout
- [x] Admin Control Tower dashboard
- [x] Customer Package Management portal (with New Package modal)
- [x] Warehouse Manager Hub dashboard
- [x] Driver Operations dashboard
- [x] Sign-out functionality
- [x] Comprehensive seed data (5 users, 4 warehouses, 10 packages, tracking events, routes)

### 🔲 Phase 4 — AI Agent Integration (Next)
- [ ] LangGraph multi-agent workflow activation
- [ ] Security Agent (prompt injection detection, role validation)
- [ ] Intent Classifier Agent
- [ ] Order Management Agent
- [ ] Routing Agent (Dijkstra / A* pathfinding)
- [ ] Warehouse Optimization Agent (capacity monitoring, load rebalancing)
- [ ] Delivery Scheduling Agent

### 🔲 Phase 5 — Advanced Features
- [ ] Real-time GPS tracking with Leaflet Maps
- [ ] QR Code scanning for custody-chain verification
- [ ] Proof of Delivery (PoD) workflow
- [ ] Package tracking timeline UI
- [ ] Warehouse capacity heatmap visualization
- [ ] Notification system (email/push)

---

## 📝 License

This project is under active development. All rights reserved.