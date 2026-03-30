# GST FraudNet — AI-Based GST Fraud Identification System

> Detect GST fraud rings, shell companies, and tax mismatches using graph analysis + machine learning.

**Team Code Novas | ITERYX '26 | Problem Statement #29 | FinTech Domain**

---

## 🎯 Problem Statement

GST fraud costs India ₹1+ Lakh Crore annually through fake invoices and circular trading.
Manual audits catch only a fraction of fraud networks. Circular invoice chains are invisible
in spreadsheets. Fraudsters create shell companies to harvest fake Input Tax Credits.

## 💡 Our Solution

An AI-powered network analysis engine that:
- Maps GST filing patterns into a **transaction graph**
- Detects **circular trading rings** using DFS cycle detection (NetworkX)
- Identifies **shell companies** from in/out degree imbalance
- Scores anomalies using **Isolation Forest + Z-Score** (Scikit-Learn)
- Visualizes everything on an **interactive D3.js fraud graph**

---

## 🔧 Tech Stack

| Layer       | Technology                  | Version |
|-------------|----------------------------|---------|
| Backend     | Python + Flask              | 3.x     |
| Graph Engine| NetworkX                   | 3.2+    |
| ML          | Scikit-Learn + SciPy       | 1.4+    |
| Database    | SQLite                     | Built-in|
| Frontend    | React + Vite               | 18 / 6  |
| Graph Viz   | D3.js                      | 7.x     |
| Fonts       | Inter + JetBrains Mono     | CDN     |

---

## 🚀 Setup (Copy-Paste Ready)

### Prerequisites
- Python 3.9+ (`python --version`)
- Node.js 18+ (`node --version`)

### Step 1 — Backend Setup

```bash
cd gst-fraud-detector/backend

# Install Python dependencies
pip install -r requirements.txt

# Generate synthetic GST data (companies + invoices + fraud patterns)
python generate_data.py

# Start Flask API server
python app.py
```

Flask will start at **http://localhost:5000**

### Step 2 — Frontend Setup

```bash
cd gst-fraud-detector/frontend

# Install Node dependencies
npm install

# Start React dev server
npm run dev
```

React will start at **http://localhost:3000**

### Step 3 — Open Dashboard
Navigate to **http://localhost:3000** in your browser.

---

## 📁 Project Structure

```
gst-fraud-detector/
├── backend/
│   ├── app.py              # Flask REST API
│   ├── generate_data.py    # Synthetic GST data generator
│   ├── graph_analysis.py   # NetworkX: cycles, shell detection, metrics
│   ├── fraud_scoring.py    # Isolation Forest + Z-Score + composite score
│   ├── requirements.txt
│   └── data/
│       ├── companies.csv
│       ├── invoices.csv
│       ├── gstr1_returns.csv
│       ├── gstr3b_returns.csv
│       └── gst_fraud.db    # SQLite database
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── index.css
    │   ├── components/
    │   │   ├── Dashboard.tsx       # Main layout
    │   │   ├── NetworkGraph.tsx    # D3.js force graph
    │   │   ├── FraudLeaderboard.tsx
    │   │   ├── RingExplorer.tsx
    │   │   ├── EntityDetail.tsx   # Modal + radar chart
    │   │   └── StatsBar.tsx
    │   └── lib/
    │       ├── api.ts
    │       └── types.ts
    ├── index.html
    ├── package.json
    └── vite.config.ts
```

---

## 🔍 How Fraud Detection Works

### 1. Graph Construction
Every invoice becomes a directed edge: **Seller → Buyer**, weighted by transaction value.

### 2. Circular Ring Detection
Using `networkx.simple_cycles()`, we find all closed loops in the transaction graph.
A→B→C→D→A is a classic circular trading ring — money moves in circles to generate fake ITC.

### 3. Shell Company Detection
If a company has high in-degree (receives many invoices) but near-zero out-degree (never sells),
it's a shell company harvesting fake Input Tax Credits without real business activity.

### 4. Anomaly Scoring
Six features per entity:
- **Tax Mismatch Ratio** — Input tax claimed vs output tax collected
- **Volume Spike Score** — Sudden jump in monthly transaction count
- **Duplicate Invoices** — Same invoice submitted multiple times
- **Ring Participation** — Number of circular chains this entity appears in
- **Shell Score** — Imbalance between buying and selling
- **PageRank Anomaly** — Unusually central node in the network

Combined using **Isolation Forest** (20%) + weighted composite score:
```
Score = cycle_participation(30%) + tax_mismatch(25%) + isolation_forest(20%)
      + volume_spike(15%) + shell_score(10%)
```

### 5. Risk Classification
| Score | Risk Level |
|-------|-----------|
| 86–100 | 🔴 CRITICAL |
| 61–85  | 🟠 HIGH     |
| 31–60  | 🟡 MEDIUM   |
| 0–30   | 🟢 LOW      |

---

## 👥 Team Members

| Name             | Role               |
|------------------|--------------------|
| Bala Saravanan K | Team Leader / ML   |
| [Team Member 2]  | Backend / Graph    |
| [Team Member 3]  | Frontend / UI      |
| [Team Member 4]  | Data / Research    |

---

## 🌏 SDG Alignment

**SDG 16 — Peace, Justice and Strong Institutions**
By automating GST fraud detection, this system supports:
- Transparent and accountable tax institutions (CBIC/GSTN)
- Reduction of illicit financial flows
- Strengthened national revenue for public services

---

## 📚 Research References

1. Pourhabibi et al. (2020) — *Fraud Detection: A Systematic Literature Review of Graph-Based Anomaly Detection*, Decision Support Systems
   → https://www.sciencedirect.com/science/article/pii/S0167923620300580

2. Cheng et al. (2024) — *Graph Neural Networks for Financial Fraud Detection: A Review*, arXiv
   → https://arxiv.org/abs/2411.05815

3. NetworkX — Cycle Detection Algorithms
   → https://networkx.org/documentation/stable/reference/algorithms/cycles.html

4. Scikit-Learn — Isolation Forest
   → https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

*Built for ITERYX '26 Hackathon | Saveetha Engineering College | Team Code Novas*
