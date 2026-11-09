import type { ScrollExperienceContent, WorkflowChapter, IconName } from '@/components/ui/dimensional-workflow-hero';
const chapter = (name: string, tag: string, title: string[], description: string, color: string, steps: { title: string; body: string }[], labels: [IconName, string, string][], status: string): WorkflowChapter => ({
  kind: 'workflow', name, tag, title, description, color, steps, status, panelLabel: 'ILLUSTRATIVE FLOW', footerLabel: 'Veyrix · Local prototype',
  diagram: { note: 'YOUR DATA. EXPLICIT ACTIONS. HUMAN CONTROL.', gradient: ['#69b7ff', '#b9a1ff', '#68dfbe'],
    nodes: labels.map(([icon, label, caption], i) => ({ icon, label, caption, x: [7, 39, 71][i], y: [30, 48, 30][i], step: i, color: ['#80baff', '#bda4ff', '#81dec9'][i] })),
    edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }] }
});
export const heroContent: ScrollExperienceContent = {
  ariaLabel: 'How the Veyrix shopping agent works', skip: { label: 'Skip animation and read the documentation', target: '#home-overview' },
  intro: { eyebrow: 'VEYRIX / CONVERSATIONAL COMMERCE', title: { lines: ['Your catalog.', 'A conversation.', 'Connected.'], emphasis: 'Connected.' }, description: ['A shopping agent that brings your products into the conversation.', 'Explore the engine. Connect your data. Stay in control.'], cta: 'Explore how it works' },
  chapters: [
    chapter('Connect your catalog', '01 / BUSINESS DATA', ['Your products.', 'A grounded answer.'], 'Give the agent a catalog it can actually read. Configure your database or import product records through the local setup tool.', '#8fb4ff', [
      { title: 'Choose your source', body: 'SQLite, PostgreSQL, or MySQL.' },
      { title: 'Map your products', body: 'Map catalog fields or import CSV and JSON.' },
      { title: 'Read live records', body: 'Retrieve prices and stock from your database.' }
    ], [['database', 'Business data', 'DATABASE / IMPORT'], ['check', 'Field mapping', 'VALIDATED CATALOG'], ['bot', 'Veyrix agent', 'GROUNDED ANSWERS']], 'Catalog reads implemented'),
    chapter('Guide the conversation', '02 / SHOPPING EXPERIENCE', ['Less searching.', 'More discovering.'], 'Turn a customer’s request into a useful shopping conversation, with catalog tools, reviews, and a temporary cart.', '#b9a1ff', [
      { title: 'Understand the request', body: 'LangChain and Groq coordinate the tool calls.' },
      { title: 'Explore the catalog', body: 'Find products and read available reviews.' },
      { title: 'Build a cart', body: 'Validate quantities against available stock.' }
    ], [['message-square', 'Customer request', 'CONVERSATION'], ['bot', 'Shopping tools', 'CATALOG + REVIEWS'], ['check', 'Session cart', 'VALIDATED ITEMS']], 'Available in the local CLI'),
    chapter('Confirm with confidence', '03 / ORDER CONTROL', ['Their order.', 'Their final say.'], 'The agent prepares the order. The customer explicitly confirms it. Database transactions keep orders and stock consistent.', '#81dec9', [
      { title: 'Review the summary', body: 'Check the items, price, and delivery details.' },
      { title: 'Confirm explicitly', body: 'A confirmation ID authorizes the action.' },
      { title: 'Commit once', body: 'Save the order and reduce stock together.' }
    ], [['user-round', 'Customer', 'REVIEWS SUMMARY'], ['shield-check', 'Confirmation', 'EXPLICIT APPROVAL'], ['database', 'Saved order', 'PAY ON DELIVERY']], 'Application schema required')
  ],
  finale: { eyebrow: 'FROM EXPLORATION TO IMPLEMENTATION', title: { lines: ['Start with your data.', 'Build from there.'], emphasis: 'Build from there.' }, cta: { label: 'Read the quickstart', href: '/docs/quickstart' } },
  navLabel: 'Explore the shopping workflow', footer: { disclaimer: 'LOCAL PROTOTYPE · ILLUSTRATIVE WORKFLOWS', scrollHint: 'SCROLL TO EXPLORE' }
};
