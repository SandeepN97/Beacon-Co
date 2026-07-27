import {
  component,
  defineMarkdocConfig,
} from "@astrojs/markdoc/config";

export default defineMarkdocConfig({
  tags: {
    callout: {
      render: component("./src/components/docs/Callout.astro"),
      attributes: {
        type: { type: String, default: "note" },
        title: { type: String },
      },
    },
    source_of_truth: {
      render: component("./src/components/docs/SourceOfTruthNotice.astro"),
      attributes: {
        state: { type: String, default: "current" },
        label: { type: String },
      },
    },
    status: {
      render: component("./src/components/docs/StatusBadge.astro"),
      attributes: {
        value: { type: String, required: true },
      },
    },
    human_gate: {
      render: component("./src/components/docs/HumanGate.astro"),
      attributes: {
        kind: { type: String, required: true },
      },
    },
    evidence: {
      render: component("./src/components/docs/EvidencePanel.astro"),
      attributes: {
        title: { type: String, default: "Evidence" },
      },
    },
    architecture_diagram: {
      render: component("./src/components/docs/ArchitectureDiagram.astro"),
      attributes: {
        src: { type: String, required: true },
        source: { type: String },
        alt: { type: String, required: true },
        caption: { type: String },
        format: { type: String, default: "image" },
      },
    },
    mermaid_diagram: {
      render: component("./src/components/docs/MermaidDiagram.astro"),
      attributes: {
        src: { type: String, required: true },
        title: { type: String, required: true },
      },
    },
    decision_card: {
      render: component("./src/components/docs/DecisionCard.astro"),
      attributes: {
        number: { type: String, required: true },
        status: { type: String, required: true },
        href: { type: String },
      },
    },
    source_reference: {
      render: component("./src/components/docs/SourceReference.astro"),
      attributes: {
        path: { type: String, required: true },
        note: { type: String },
      },
    },
    workflow_step: {
      render: component("./src/components/docs/WorkflowStep.astro"),
      attributes: {
        number: { type: Number, required: true },
        title: { type: String, required: true },
        owner: { type: String },
      },
    },
    work_unit: {
      render: component("./src/components/docs/WorkUnitExample.astro"),
      attributes: {
        title: { type: String, default: "Validated work unit" },
      },
    },
    role_matrix: {
      render: component("./src/components/docs/RoleMatrix.astro"),
      attributes: {
        title: { type: String, default: "Role boundary" },
      },
    },
    agent_card: {
      render: component("./src/components/docs/AgentCard.astro"),
      attributes: {
        role: { type: String, required: true },
        lane: { type: String, required: true },
        href: { type: String },
      },
    },
    intent_preview: {
      render: component("./src/components/docs/IntentPreview.astro"),
      attributes: {
        title: { type: String, default: "Intent interpretation" },
      },
    },
    provider_decision: {
      render: component("./src/components/docs/ProviderDecision.astro"),
      attributes: {
        provider: { type: String, required: true },
        reason: { type: String, required: true },
        simulated: { type: Boolean, default: true },
      },
    },
    decision_table: {
      render: component("./src/components/docs/DecisionTable.astro"),
      attributes: {
        title: { type: String, default: "Decision record" },
      },
    },
  },
});
