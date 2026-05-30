# Arcantect Gameplay Analysis

Arcantect is a cloud architecture puzzle game built around spatial reasoning, architectural tradeoffs, and live rule feedback. The player reads a scenario, places infrastructure runes on a canvas, connects them with typed edges, and iterates until the architecture satisfies the puzzle rubric.

The game is not trying to teach cloud products as a catalog. Its core design goal is to make players reason about why a component belongs in a system, where it sits in a request or data path, and what second-order effects it creates.

## Core Gameplay Loop

1. **Read the scenario brief.** Each puzzle presents a story-framed system design problem with concrete operational pressures: traffic spikes, durability, latency, security boundaries, or third-party integrations.
2. **Place runes.** Players drag infrastructure components from the spellbook into the canvas. Most input/context nodes are pre-placed so the puzzle has stable anchors.
3. **Connect flows.** Edges model how requests, events, deployments, or policy attachments move between nodes.
4. **Read live feedback.** The side panel updates requirements, restrictions, and violations as the graph changes.
5. **Submit for a verdict.** The result screen awards stars based on correctness, optional capability goals, weighted tradeoffs, and optimization budget.

This loop rewards experimentation. Because feedback is immediate, the puzzle can teach through correction instead of relying on a long explanation before play.

## Design Pillars

### Architecture as a Graph

Every solution is a graph of typed nodes and typed edges. This is a strong fit for system design because most architectural questions are relationship questions:

- Can public traffic reach the entry point?
- Does the request path pass through a protective boundary?
- Is durable work decoupled from synchronous traffic?
- Can a service reach the data store or processor it depends on?
- Is a sensitive system isolated from broader application flow?

The graph model makes architecture visible and testable. A node alone is rarely enough; scoring usually asks whether the node is reachable from the correct place, attached with the correct relationship, or isolated from the wrong path.

### Scenario-First Requirements

Puzzle text is written as an in-world brief, but each sentence maps to a system design need. For example, the SPA puzzle's "remembered name" implies DNS, "trusted copies" implies CDN edge delivery, and "storehouse of originals" implies object storage. The Midnight Market puzzle maps browsing load, purchase durability, inventory consistency, payment isolation, and observability into separate requirements.

This design lets hints and requirement labels stay thematic while the scorer remains concrete.

### Multiple Valid Architectures

The Datalog scorer checks architectural properties rather than exact diagrams. For example, Midnight Market accepts Queue, Event Bus, or Data Stream for durable order intake. Compute may be Server, Serverless Function, Container, or Kubernetes where the rules use the `isCompute` helper.

This is important game design: players are solving intent, not copying a reference image.

### Progressive Mastery

Arcantect separates "it works" from "it is excellent." Passing the required constraints means the architecture is viable. Higher stars ask for capability goals, better tradeoff profiles, and compactness. This keeps early progress achievable while still leaving room for mastery.

## Rune System

Runes are the player's vocabulary. Each rune has:

- **Category:** Compute, Storage, Network, Security, Messaging, Observability, or Input.
- **Capabilities:** Semantic tags such as `edge-delivery`, `static-origin`, `compute-layer`, `durable-messaging`, or `identity-verification`.
- **Tradeoff deltas:** Signed values for dimensions such as latency, cost, operability, security, throughput, consistency, complexity, and blast radius.
- **Default edge behavior:** Some runes default to special relationships, such as `applies` for WAF/Auth-style policy nodes or `hosts` for application-to-compute placement.

Capabilities make puzzle rules more general. The SPA puzzle does not need to hard-code "CDN" everywhere; it can ask whether a reachable node has `edge-delivery`. Tradeoffs make every added rune carry design weight, even when the rune helps satisfy a requirement.

## Edge Semantics

Edges are not just lines. They are normalized into scorer edges with:

- `direction`: `directed`, `applies`, or `hosts`
- `flowType`: inferred from endpoint types, such as `https-request`, `db-query`, `event`, `file-io`, `dns-resolution`, or `deployment`
- `encrypted`: inferred from public-facing sources unless explicitly configured

The specialized edge directions are central to puzzle readability:

- **Directed edges** represent traffic, data, event, or dependency flow.
- **Apply edges** represent policy or control attachment, such as WAF applied to API Gateway.
- **Host edges** represent application services running on compute nodes.

This distinction prevents misleading diagrams from passing. In Midnight Market, a WAF placed inline on a request path is not equivalent to a WAF applied to the API Gateway; the scoring rule explicitly checks for an `applies` edge.

## Scoring Model

Scoring starts in `scoreGraph(rawNodes, rawEdges, rubric, puzzleContext)`.

1. Raw React Flow nodes and edges are normalized into scorer-owned nodes and edges.
2. Node capabilities and tradeoff deltas are attached from the client registry.
3. Restriction detectors run against the normalized graph.
4. Node and edge facts are generated for the Datalog evaluator.
5. Puzzle-authored Datalog rules derive `req(id, outcome)`, `capgoal(id, outcome)`, and `violation(id, target)` facts.
6. Datalog results are merged back into the rubric metadata so labels and hints remain available to the UI.
7. The scorer computes pass/fail and star rating.

### Hard Constraints

Hard constraints are the core requirements of a puzzle. A solution passes only when every non-bonus hard constraint passes and no restriction or Datalog violation blocks it.

Hard constraints are intentionally concrete. They test structural properties such as:

- Internet connects to DNS or API Gateway.
- Static assets are reachable through a static origin.
- A service is hosted on compute.
- Order intake writes to durable messaging.
- Payment compute can reach secrets and the payment processor.
- Two database nodes exist for high availability.

Each hard constraint should have both a pass and fail derivation in Datalog. This keeps feedback explicit and avoids ambiguous "not yet evaluated" states.

### Capability Goals

Capability goals are secondary objectives that deepen a correct solution. The SPA puzzle uses them for:

- Reachable edge delivery.
- Proper non-compute static origin.
- DNS routing toward edge delivery.

Capability goals affect stars rather than base pass/fail. This allows the puzzle to distinguish a minimally functional design from a well-architected one.

### Restrictions

Restrictions are negative rules. They catch dangerous structures that may otherwise satisfy positive requirements.

Midnight Market currently includes `naive-payment-path`, which detects whether ingress can reach the external payment processor without passing through a Queue, Event Bus, or Data Stream. This is a strong design constraint because the puzzle's story explicitly says payment processing must be separated from ordinary shop traffic and decoupled from synchronous request load.

Restrictions differ from hard constraints because they describe forbidden topology, not missing topology.

### Tradeoff Profile

Every placed rune contributes signed tradeoff deltas. The scorer aggregates those deltas into a `TradeoffProfile`.

For puzzles that define `tradeoffWeights`, the weighted score is:

```text
tradeoffScore = sum(profile[dimension] * weight[dimension])
```

The SPA puzzle weights latency most heavily:

```text
latency: 2
cost: 1
operability: 1
security: 1
threshold: 6
```

This pushes players toward a CDN and object storage architecture because those runes improve latency and operability enough to justify their cost tradeoffs. A server can technically expose static assets because it has `static-origin`, but the capability goal rejects compute as the preferred origin.

### Star Rating

The scorer returns one to three stars:

- **1 star:** The puzzle is incomplete, failed, or passed without all capability goals.
- **2 stars:** The core puzzle passes and all capability goals pass, but tradeoff threshold or optimization budget is missed.
- **3 stars:** The puzzle passes, all capability goals pass, weighted tradeoffs meet the threshold, and the solution stays within node/edge budget.

This means "passed" and "excellent" are separate judgments. A player can create a working but overbuilt architecture and still receive useful feedback.

## Datalog Rule Design

Datalog is the main scoring language for graph-wide reasoning. The fact generator emits facts such as:

```prolog
node(NodeId, RuneType).
capability(NodeId, Capability).
edge(Source, Target).
edgeById(EdgeId, Source, Target).
edgeMeta(EdgeId, "direction", Direction).
edgeMeta(EdgeId, "flowType", FlowType).
edgeMeta(EdgeId, "encrypted", "true").
puzzleTag(Tag).
```

Puzzle rules usually define helper predicates first, then map them into public scorer predicates:

```prolog
reaches(X, Y) :- edge(X, Y).
reaches(X, Z) :- edge(X, Y), reaches(Y, Z).

hasInternetToDns("yes") :-
  node(I, "internet"),
  node(R, "dns"),
  edge(I, R).

req("starts-from-internet", "pass") :- hasInternetToDns("yes").
req("starts-from-internet", "fail") :- !hasInternetToDns("yes").
```

This pattern makes scoring explainable. Helpers describe architectural concepts, and `req`/`capgoal` facts expose the player's progress to the UI.

## Puzzle Analysis: SPA Signboard

The SPA puzzle is the introductory architecture challenge. It teaches the shape of a static web application:

- Users enter from the Internet.
- A remembered name resolves through DNS.
- A CDN serves cached copies close to users.
- Object Storage holds the static assets at origin.
- Static Assets are the final content being served.

### Intended Learning

The puzzle teaches that static applications do not need an always-running compute service. The best solution separates naming, edge delivery, origin storage, and assets.

The key design lesson is origin choice. Because Server has both `compute-layer` and `static-origin`, a naive player may use compute as an origin. The `storage-at-origin` capability goal rejects that as a best-practice solution by requiring `static-origin` without `compute-layer`.

### Scoring Shape

The two hard constraints establish basic viability:

- `starts-from-internet`: Internet must connect directly to DNS.
- `static-files-distributed`: Internet must reach a static-origin node, and that origin must reach Static Assets.

The three capability goals define the high-quality version:

- `edge-delivery-present`: A reachable edge-delivery node exists.
- `storage-at-origin`: A static-origin node exists that is not compute.
- `dns-routes-to-delivery`: DNS can reach an edge-delivery node.

The optimal player path is likely:

```text
Internet -> DNS -> CDN -> Object Storage -> Static Assets
```

This uses five nodes including the two pre-placed anchors and four edges, staying under the SPA budget of six nodes and six edges.

### Design Notes

The SPA puzzle is a good first puzzle because it has a small graph, clear real-world analogy, and a visible difference between "it serves files" and "it serves files well."

One implementation note: the SPA Datalog includes an `unencrypted-cross-zone` violation that checks `edgeMeta(E, "crossesZone", "true")`, but the current fact generator does not emit `crossesZone`. Until zone metadata is emitted again, that violation cannot trigger.

## Puzzle Analysis: Midnight Market

Midnight Market is the advanced systems puzzle. It asks the player to design an e-commerce architecture under extreme read and write load while preserving payment isolation and inventory correctness.

### Intended Learning

The puzzle combines several architecture lessons:

- Public traffic needs a clear API ingress path.
- Malicious traffic should be filtered before it reaches application routing.
- Load should be distributed across compute.
- Browsing and purchasing should not block each other.
- Orders should be captured durably before asynchronous processing.
- Inventory needs transactional consistency.
- Payment credentials belong in a secrets store.
- Payment processing should be isolated from general application compute.
- Production systems need observability.

### Scoring Shape

The puzzle pre-places Internet, Payment Processor, and three application service nodes: Catalog Service, Order Service, and Payment Service. The player must decide where those services run and how they interact with infrastructure.

Core requirements cover:

- API Gateway as public gate.
- WAF applied to API Gateway.
- Load Balancer between API Gateway and compute.
- Catalog, Order, and Payment services hosted on compute.
- Cache attached to catalog compute.
- Auth present in the architecture.
- Order compute writing to durable messaging.
- A processor consuming from messaging.
- Relational database for inventory.
- Second database node for high availability.
- Payment service isolated on dedicated compute.
- Payment compute connected to Secrets Manager.
- Payment compute connected to Payment Processor.

Bonus requirements reward CDN and observability.

### Architectural Tensions

Midnight Market's strongest design tension is between consolidation and isolation. Kubernetes can host multiple services and provides throughput benefits, but if Catalog, Order, and Payment all point to the same Kubernetes node, the payment isolation rule fails because all three services share the same node ID.

The payment path restriction creates another useful tension. A direct path from ingress to Payment Processor is forbidden unless the route passes through durable messaging. This steers the player away from synchronous checkout coupling and toward asynchronous order capture.

### Design Notes

Midnight Market is a good second puzzle because it layers multiple independent subsystems: ingress, read path, write path, data integrity, payment boundary, and operations. The player has to reason about the whole architecture, not a single best-practice component.

The current puzzle uses many hard constraints and only two bonus requirements. Future tuning could move some advanced concerns, such as observability depth or CDN catalog acceleration, into capability goals to create a smoother star progression.

## Feedback Design

The UI exposes three kinds of feedback:

- **Requirements:** Positive checklist items the player is trying to satisfy.
- **Restrictions:** Safety rules that must remain upheld.
- **Violations:** Concrete Datalog-derived blockers.

This gives the player both a target and guardrails. A checklist alone can lead to cargo-cult placement; restrictions force players to think about unsafe paths and accidental coupling.

Hints are attached to every requirement and restriction. They are most useful when they name the architectural concept without giving away the exact final graph. The best hints say what kind of relationship is missing, such as "apply WAF to API Gateway" or "write incoming orders to a Queue, Event Bus, or Data Stream."

## Balance And Tuning Opportunities

### Keep Early Puzzles Small

SPA works because the correct solution is compact and the wrong solutions are easy to understand. Future easy puzzles should preserve that quality: few pre-placed nodes, one primary request path, and one architectural improvement goal.

### Use Capability Goals For Best Practices

Capability goals are ideal for "good architecture" checks that should not block basic completion. Examples:

- CDN in front of cacheable content.
- Observability wired to critical compute.
- Secrets Manager used instead of raw config.
- Private networking around data stores.

This gives players a runway from solved to optimized.

### Keep Restrictions Rare And Memorable

Restrictions should represent serious architectural mistakes, not minor preferences. They work best when the player can understand the unsafe pattern visually: public path to data without auth, payment direct from ingress, or a single database when the scenario demands failover.

### Align Tradeoffs With Puzzle Theme

Tradeoff weights should reinforce the story. SPA emphasizes latency and operability. A compliance puzzle should weight security and blast radius. A flash-sale puzzle should weight throughput and consistency. A cost-reduction puzzle should make cost a positive target and punish unnecessary infrastructure.

### Watch For Over-Specified Solutions

Datalog makes it easy to overfit rules to one intended diagram. The best rules use capability predicates and reachability helpers when possible. Hard-coding specific node types is appropriate when the learning objective is specific, such as relational databases for inventory consistency.

## Summary

Arcantect's design is strongest when each puzzle asks players to translate a product pressure into graph structure. The canvas makes architecture tactile, Datalog makes scoring expressive, and the star system separates correctness from excellence.

The current SPA and Midnight Market puzzles already demonstrate a useful progression: first a compact static delivery system, then a larger commerce system with load, durability, consistency, security, and operations concerns. The main opportunity is to keep expanding the distinction between hard correctness, optional best practices, and weighted tradeoff mastery.
