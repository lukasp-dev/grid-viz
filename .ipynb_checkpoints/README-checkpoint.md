# OPF Visualization Platform

Full-stack application for IEEE 57-Bus Optimal Power Flow (OPF) optimization and visualization.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [API Documentation](#api-documentation)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+ (or 20+ recommended for latest Vite)
- Gurobi Optimizer (with valid license)

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (first time only)
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies (first time only)
pip install -r requirements.txt

# Start the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Backend URL:** `http://localhost:8000`  
**API Docs:** `http://localhost:8000/docs`

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

**Frontend URL:** `http://localhost:5173`

### 3. Test Backend

```bash
# Health check
curl http://localhost:8000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "data_loaded": true,
  "num_buses": 57,
  "num_branches": 80,
  "num_generators": 7
}
```

---

## 🔧 Backend Setup

### Project Structure

```
backend/
├── data/
│   └── pglib_opf_case57_ieee.m    # IEEE 57-bus system data
├── main.py                         # FastAPI application
├── opf_solver.py                   # OPF optimization solver
├── requirements.txt                # Python dependencies
├── venv/                           # Virtual environment
└── test_solver.py                  # Test script
```

### API Endpoints

#### 1. Health Check
```bash
curl http://localhost:8000/api/health
```

<details>
<summary>📄 Response Example</summary>

```json
{
  "status": "healthy",
  "data_loaded": true,
  "num_buses": 57,
  "num_branches": 80,
  "num_generators": 7
}
```
</details>

---

#### 2. Get Network Topology
```bash
curl http://localhost:8000/api/topology
```

<details>
<summary>📄 Response Example (Full topology data)</summary>

**Note**: Response includes ALL 57 buses and 80 branches for complete network visualization

```json
{
  "nodes": [
    {"id": 1, "type": "slack", "load": 55.0, "voltage": 1.04},
    {"id": 2, "type": "generator", "load": 3.0, "voltage": 1.01},
    {"id": 3, "type": "generator", "load": 41.0, "voltage": 0.985},
    {"id": 4, "type": "load", "load": 0.0, "voltage": 0.981},
    {"id": 5, "type": "load", "load": 13.0, "voltage": 0.976},
    ...
    {"id": 57, "type": "load", "load": 6.7, "voltage": 0.965}
  ],
  "edges": [
    {"id": 0, "source": 1, "target": 2, "reactance": 0.0173, "capacity": 250.0},
    {"id": 1, "source": 2, "target": 3, "reactance": 0.0379, "capacity": 250.0},
    {"id": 2, "source": 3, "target": 4, "reactance": 0.0131, "capacity": 250.0},
    ...
    {"id": 79, "source": 38, "target": 49, "reactance": 0.0712, "capacity": 150.0}
  ],
  "num_buses": 57,
  "num_branches": 80,
  "num_generators": 7,
  "total_load": 1250.8
}
```

**Data Structure:**
- **57 nodes** with bus ID, type (slack/generator/load), load (MW), voltage (p.u.)
- **80 edges** with branch ID, source/target buses, reactance (p.u.), capacity (MVA)
- Complete connectivity information for network visualization
</details>

---

#### 3. Run Optimization

**Basic OPF:**
```bash
curl -X POST http://localhost:8000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{"constraints": []}'
```

<details>
<summary>📄 Response Example (Full optimization results)</summary>

**Note**: Response includes ALL generator outputs, ALL 80 branch flows, and ALL 57 bus angles

```json
{
  "status": "optimal",
  "objective": 34772.95,
  "total_generation": 1250.8,
  "total_load": 1250.8,
  "generators": {
    "0": {"bus": 1, "Pg": 128.90, "Pmax": 575.88, "Pmin": 0.0},
    "1": {"bus": 2, "Pg": 0.0, "Pmax": 100.0, "Pmin": 0.0},
    "2": {"bus": 3, "Pg": 40.0, "Pmax": 140.0, "Pmin": 0.0},
    "3": {"bus": 6, "Pg": 0.0, "Pmax": 100.0, "Pmin": 0.0},
    "4": {"bus": 8, "Pg": 450.0, "Pmax": 550.0, "Pmin": 100.0},
    "5": {"bus": 9, "Pg": 0.0, "Pmax": 100.0, "Pmin": 0.0},
    "6": {"bus": 12, "Pg": 310.0, "Pmax": 410.0, "Pmin": 0.0}
  },
  "branches": {
    "0": {"fbus": 1, "tbus": 2, "flow": 73.12, "capacity": 250.0, "utilization": 29.25, "status": 1.0},
    "1": {"fbus": 2, "tbus": 3, "flow": -15.67, "capacity": 250.0, "utilization": 6.27, "status": 1.0},
    ...
    "79": {"fbus": 38, "tbus": 49, "flow": 5.43, "capacity": 150.0, "utilization": 3.62, "status": 1.0}
  },
  "bus_angles": {
    "1": 0.0,
    "2": -1.23,
    "3": -2.45,
    ...
    "57": -5.67
  },
  "lines_on": 80,
  "lines_off": 0
}
```

**Visualization Data:**
- **7 generator outputs** (Pg, Pmax, Pmin for each)
- **80 branch flows** with power flow (MW), utilization (%), switching status (0=off, 1=on)
- **57 bus angles** (degrees) for voltage angle visualization
- Complete power flow information for network diagram
</details>

**With Line Switching:**
```bash
curl -X POST http://localhost:8000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{"constraints": ["line_switching"]}'
```

<details>
<summary>📄 Response Example (With line switching)</summary>

**Note**: Shows which lines are ON/OFF. Lines with `status: 0.0` are switched off.

```json
{
  "status": "optimal",
  "objective": 34772.95,
  "total_generation": 1250.8,
  "total_load": 1250.8,
  "lines_on": 56,
  "lines_off": 24,
  "branches": {
    "0": {"fbus": 1, "tbus": 2, "flow": 73.12, "capacity": 250.0, "utilization": 29.25, "status": 1.0},
    "1": {"fbus": 2, "tbus": 3, "flow": -15.67, "capacity": 250.0, "utilization": 6.27, "status": 1.0},
    "5": {"fbus": 3, "tbus": 15, "flow": 0.0, "capacity": 150.0, "utilization": 0.0, "status": 0.0},
    "12": {"fbus": 7, "tbus": 8, "flow": 0.0, "capacity": 175.0, "utilization": 0.0, "status": 0.0},
    ...
    "79": {"fbus": 38, "tbus": 49, "flow": 5.43, "capacity": 150.0, "utilization": 3.62, "status": 1.0}
  }
}
```

**Topology Changes:**
- Lines with `status: 0.0` are **switched OFF** (shown with dashed lines in visualization)
- Lines with `status: 1.0` are **ON** (solid lines)
- 24 lines switched off to reduce total cost
</details>

**With Adjustable Parameters:**
```bash
curl -X POST http://localhost:8000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "constraints": ["line_switching", "angle_bound"],
    "angle_bound_degrees": 20,
    "load_multiplier": 1.5,
    "generator_capacity_multiplier": 1.2,
    "capacity_limit_multiplier": 0.8
  }'
```

<details>
<summary>📄 Response Example</summary>

```json
{
  "status": "optimal",
  "objective": 52159.42,
  "total_generation": 1876.2,
  "total_load": 1876.2,
  "lines_on": 58,
  "lines_off": 22
}
```
</details>

---

#### 4. Get Available Constraints
```bash
curl http://localhost:8000/api/constraints
```

<details>
<summary>📄 Response Example</summary>

```json
{
  "constraints": [
    {
      "id": "line_switching",
      "name": "Line Switching",
      "description": "Allow binary line switching (on/off) to optimize power flow"
    },
    {
      "id": "angle_bound",
      "name": "Angle Bounds",
      "description": "Limit angle differences per line (adjustable, default: ±30°)"
    },
    {
      "id": "capacity",
      "name": "Capacity Constraints",
      "description": "Enforce branch capacity limits"
    }
  ],
  "note": "You can combine multiple constraints in the optimize request"
}
```
</details>

---

### Adjustable Parameters

All parameters are optional and have default values:

| Parameter | Type | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| `angle_bound_degrees` | float | 5-60 | 30 | Angle difference limit per line (degrees) |
| `load_multiplier` | float | 0.1-2.0 | 1.0 | Multiply all bus loads |
| `generator_capacity_multiplier` | float | 0.1-2.0 | 1.0 | Multiply all generator max capacities |
| `capacity_limit_multiplier` | float | 0.5-1.5 | 1.0 | Multiply all branch capacity limits |

### Available Constraints

- **`line_switching`**: Binary line switching (on/off) to optimize topology
- **`angle_bound`**: Limit angle differences per line (default ±30°, adjustable)
- **`capacity`**: Enforce branch capacity constraints (adjustable limit multiplier)

---

## 💻 Frontend Setup

### Project Structure

```
frontend/
├── src/
│   ├── api/                    # API client & hooks
│   │   ├── client.ts          # Fetch functions
│   │   ├── hooks.ts           # React Query hooks
│   │   ├── types.ts           # TypeScript types
│   │   └── utils.ts           # Data transformation
│   ├── components/
│   │   ├── ApiTest.tsx        # API testing dashboard
│   │   ├── FlowCanvas.tsx     # React Flow canvas
│   │   └── ui/                # shadcn/ui components
│   ├── lib/
│   │   └── utils.ts           # Utility functions
│   ├── App.tsx                # Main app component
│   └── main.tsx               # App entry point
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

### Key Features

#### 1. API Testing Dashboard (`/api-test`)
- Test all backend endpoints
- Adjust optimization parameters with sliders
- View results in real-time

#### 2. React Flow Canvas
- Interactive network visualization
- localStorage persistence (survives page refresh)
- Drag & drop nodes

#### 3. Adjustable Parameters UI
- **Angle Bound**: ±5° to ±60° (slider)
- **Load Multiplier**: 0.1x to 2.0x (slider)
- **Generator Capacity**: 0.1x to 2.0x (slider)
- **Branch Capacity Limit**: 50% to 150% (slider)

### Scripts

```bash
# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Code formatting (Prettier)
npm run format

# Linting
npm run lint
```

### Configuration

#### `.env` File
```env
# Development (default)
VITE_API_URL=http://localhost:8000

# Production with Ngrok
# VITE_API_URL=https://your-ngrok-url.ngrok.io
```

#### Prettier (`.prettierrc`)
```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100
}
```

---

## ✨ Features

### Backend
- ✅ **RESTful API** with FastAPI
- ✅ **Multiple Constraints**:
  - Line switching (binary on/off)
  - Angle bounds (adjustable ±5° to ±60°)
  - Capacity limits (adjustable 50% to 150%)
- ✅ **Adjustable Parameters**:
  - Load multiplier (0.1x to 2.0x)
  - Generator capacity multiplier (0.1x to 2.0x)
- ✅ **IEEE 57-bus System** data
- ✅ **Gurobi Optimizer** integration
- ✅ **CORS** enabled for frontend

### Frontend
- ✅ **Interactive Visualization** with React Flow
- ✅ **Real-time Optimization** controls
- ✅ **Parameter Sliders** for easy adjustment
- ✅ **localStorage Persistence** (survives refresh)
- ✅ **Modern UI** with Tailwind CSS + shadcn/ui
- ✅ **TypeScript** for type safety
- ✅ **React Query** for API state management

---

## 🛠 Technology Stack

### Backend
- **Python** 3.12
- **FastAPI** - Modern web framework
- **Gurobi** 12.0.3 - Optimization solver
- **Pandas, NumPy** - Data processing
- **Uvicorn** - ASGI server

### Frontend
- **React** 19 - UI library
- **TypeScript** - Type safety
- **Vite** 5 - Build tool (Node 18 compatible)
- **React Flow** - Graph visualization
- **Zustand** - State management
- **TanStack Query** - Server state
- **Tailwind CSS** 3 - Styling
- **shadcn/ui** - UI components

---

## 🐛 Troubleshooting

### Backend Issues

#### Port Already in Use
```bash
# Find and kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Or use a different port
uvicorn main:app --host 0.0.0.0 --port 8001
```

#### Virtual Environment Not Activated
```bash
# Check which Python you're using
which python
# Should show: .../backend/venv/bin/python

# If not, activate it
source venv/bin/activate
```

#### Gurobi License Error
Ensure your Gurobi license path is correct in `backend/main.py`:
```python
os.environ["GRB_LICENSE_FILE"] = "/path/to/your/gurobi.lic"
```

### Frontend Issues

#### Node Version Error
Vite 7 requires Node.js 20+. If you're using Node 18:
- Use Vite 5 (already configured in this project)
- Or upgrade Node.js to 20+

#### CORS Error
1. Verify backend is running: `curl http://localhost:8000/api/health`
2. Check `backend/main.py` has CORS middleware enabled
3. Verify `VITE_API_URL` in frontend `.env`

#### React Flow Import Error
If you see "Connection type not found":
- Imports are already configured with `type` keyword
- Make sure dependencies are installed: `npm install`

---

## 🌐 Deployment with Ngrok

### Step 1: Start Backend
```bash
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Step 2: Expose with Ngrok
```bash
# Install ngrok (first time only)
brew install ngrok

# Create tunnel
ngrok http 8000
```

Copy the generated URL (e.g., `https://xxxx.ngrok.io`)

### Step 3: Configure Frontend
Update `frontend/.env`:
```env
VITE_API_URL=https://xxxx.ngrok.io
```

Then start frontend:
```bash
cd frontend
npm run dev
```

---

## 📝 Author

Jewook Park  
November 2025

## 📄 License

For research and educational purposes only.
