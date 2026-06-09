# Graph Report - .  (2026-06-04)

## Corpus Check
- Corpus is ~10,928 words - fits in a single context window. You may not need a graph.

## Summary
- 331 nodes · 534 edges · 21 communities (14 shown, 7 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_React UI Components|React UI Components]]
- [[_COMMUNITY_Frontend Auth & State|Frontend Auth & State]]
- [[_COMMUNITY_Backend Controllers|Backend Controllers]]
- [[_COMMUNITY_Express Server & Middleware|Express Server & Middleware]]
- [[_COMMUNITY_Architecture & Data Model|Architecture & Data Model]]
- [[_COMMUNITY_Backend Dependencies|Backend Dependencies]]
- [[_COMMUNITY_Classifier & Compliance Logic|Classifier & Compliance Logic]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_Compliance Module|Compliance Module]]
- [[_COMMUNITY_Railway Deployment|Railway Deployment]]
- [[_COMMUNITY_Database Seed & Schema|Database Seed & Schema]]
- [[_COMMUNITY_VS Code Launch Config|VS Code Launch Config]]
- [[_COMMUNITY_Claude Settings|Claude Settings]]
- [[_COMMUNITY_Frontend CSS Config|Frontend CSS Config]]
- [[_COMMUNITY_Google Drive Auth|Google Drive Auth]]
- [[_COMMUNITY_Google Drive Session|Google Drive Session]]
- [[_COMMUNITY_Claude Permissions|Claude Permissions]]
- [[_COMMUNITY_Storage Read|Storage Read]]

## God Nodes (most connected - your core abstractions)
1. `Axios API Client (lib/api.js)` - 16 edges
2. `dependencies` - 11 edges
3. `App.jsx — React Router Root` - 10 edges
4. `config` - 9 edges
5. `isGoogleConfigured()` - 8 edges
6. `extractText()` - 8 edges
7. `API Router (index)` - 8 edges
8. `scripts` - 7 edges
9. `prisma` - 7 edges
10. `ingestDocument()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `CloudConnect Page (HU09)` --implements--> `HU09: Google Drive Integration`  [INFERRED]
  frontend/src/pages/CloudConnect.jsx → README.md
- `Vite Config (frontend)` --conceptually_related_to--> `API Router (index)`  [INFERRED]
  frontend/vite.config.js → backend/src/routes/index.js
- `Dashboard Page` --implements--> `HU02: Compliance Calculation`  [INFERRED]
  frontend/src/pages/Dashboard.jsx → README.md
- `Documents Page` --implements--> `HU07: Evidence Upload`  [INFERRED]
  frontend/src/pages/Documents.jsx → README.md
- `Upload Page` --implements--> `HU07: Evidence Upload`  [INFERRED]
  frontend/src/pages/Upload.jsx → README.md

## Communities (21 total, 7 thin omitted)

### Community 0 - "React UI Components"
Cohesion: 0.06
Nodes (33): Layout(), NAV, ProtectedRoute(), MAP, AuthContext, AuthProvider(), useAuth(), useAssociationAction() (+25 more)

### Community 1 - "Frontend Auth & State"
Cohesion: 0.07
Nodes (48): AuthContext (useAuth hook), AuthProvider Context, useAuth Hook, Traffic Light Visual Compliance Indicator, Duplicate File Handling (replace/keep), JWT Token in localStorage, Docker Compose Infrastructure, Backend Docker Service (+40 more)

### Community 2 - "Backend Controllers"
Cohesion: 0.1
Nodes (31): prisma, login(), me(), classifyDocument(), rejectAssociation(), validateAssociation(), getCriterion(), getReportStructure() (+23 more)

### Community 3 - "Express Server & Middleware"
Cohesion: 0.11
Nodes (24): config, isGoogleConfigured(), maxFileSizeBytes(), authUrl(), callback(), importFile(), listFiles(), NOT_CONFIGURED (+16 more)

### Community 4 - "Architecture & Data Model"
Cohesion: 0.11
Nodes (31): Express App Factory (createApp), Backend Package (qualitrack-backend), Claude Launch Config (Frontend Dev), Document-Subcriterion Association (PROPOSED/VALIDATED/NOT_VALIDATED), CNA Criterio 9 — Aseguramiento de la Calidad, Document Ingestion Pipeline (save → extract → record), Google OAuth2 Flow (state=JWT, redirect URI), JWT Authentication (Bearer token, 12h expiry) (+23 more)

### Community 5 - "Backend Dependencies"
Cohesion: 0.07
Nodes (29): dependencies, bcryptjs, cors, express, googleapis, jsonwebtoken, mammoth, multer (+21 more)

### Community 6 - "Classifier & Compliance Logic"
Cohesion: 0.13
Nodes (24): classifyText(text, subcriteria), findFragment(originalText, keyword), Classifier Service (MOCK), THREE_YEARS_MS constant, buildComplianceReport(subcriteria, now), isCurrent(documentDate, now), Compliance Service (HU02), statusColor(status) — semáforo (+16 more)

### Community 7 - "Frontend Dependencies"
Cohesion: 0.09
Nodes (21): dependencies, axios, react, react-dom, react-router-dom, @tanstack/react-query, devDependencies, autoprefixer (+13 more)

### Community 8 - "Compliance Module"
Cohesion: 0.23
Nodes (9): getCompliance(), buildComplianceReport(), isCurrent(), statusForSubcriterion(), byCode, doc(), NOW, report (+1 more)

### Community 9 - "Railway Deployment"
Cohesion: 0.25
Nodes (7): build, builder, dockerfilePath, deploy, restartPolicyMaxRetries, restartPolicyType, $schema

### Community 10 - "Database Seed & Schema"
Cohesion: 0.4
Nodes (3): prisma, REPORT_SECTIONS, SUBCRITERIA

## Knowledge Gaps
- **88 isolated node(s):** `$schema`, `builder`, `dockerfilePath`, `restartPolicyType`, `restartPolicyMaxRetries` (+83 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `API Router (index)` connect `Classifier & Compliance Logic` to `Architecture & Data Model`, `Frontend Dependencies`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `Express App Factory (createApp)` connect `Architecture & Data Model` to `Classifier & Compliance Logic`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `createApp()` connect `Backend Dependencies` to `Express Server & Middleware`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **What connects `$schema`, `builder`, `dockerfilePath` to the rest of the system?**
  _89 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `React UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Frontend Auth & State` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Backend Controllers` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._