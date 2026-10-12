// Every edge represents stored evidence, never an inferred prerequisite.
export function buildLearningMemoryGraph(entries = []) {
  const nodes = [], edges = [], concepts = new Map();
  for (const entry of entries) {
    const attemptId = `attempt:${entry.id}`;
    nodes.push({ id: attemptId, label: `Attempt ${entry.attempt}`, kind: 'attempt', records: [entry] });
    const items = entry.observations?.concepts || [];
    if (items.length) {
      for (const item of items) {
        const key = item.concept.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
        if (!key) continue;
        const id = `concept:${key}`;
        if (!concepts.has(id)) {
          const node = { id, label: item.concept.trim(), kind: 'concept', records: [] };
          concepts.set(id, node); nodes.push(node);
        }
        concepts.get(id).records.push({ ...entry, detail: item });
        if (!edges.some(edge => edge.source === attemptId && edge.target === id)) edges.push({ source: attemptId, target: id });
      }
    } else {
      // Older journals have no concept-level evidence. Preserve them honestly.
      for (const [field, signal] of [['strengths', 'demonstrated'], ['areas_to_improve', 'difficulty'], ['next_steps', 'practice']]) {
        (entry.observations?.[field] || []).forEach((text, index) => {
          const id = `observation:${entry.id}:${field}:${index}`;
          nodes.push({ id, label: text, kind: 'observation', records: [{ ...entry, detail: { observation: text, signal, answer_ids: entry.source_answer_ids || [] } }] });
          edges.push({ source: attemptId, target: id });
        });
      }
    }
  }
  for (const node of nodes) {
    node.records.sort((a, b) => new Date(b.date) - new Date(a.date) || b.attempt - a.attempt);
    node.signal = node.records[0]?.detail?.signal || 'attempt';
  }
  if (!nodes.length) return { nodes, edges };
  const attempts = nodes.filter(node => node.kind === 'attempt');
  const root = { id: 'memory', label: 'Learning memory', kind: 'memory', signal: 'memory', records: [], x: 0, y: 0 };
  nodes.unshift(root);
  // Radial mind map: student memory → attempts → recorded concepts/observations.
  // Shared concepts retain links to every supporting attempt.
  const branchRadius = Math.max(240, attempts.length * 70);
  attempts.forEach((attempt, index) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / attempts.length;
    attempt.x = Math.cos(angle) * branchRadius;
    attempt.y = Math.sin(angle) * branchRadius;
    edges.push({ source: root.id, target: attempt.id });
    const children = edges.filter(edge => edge.source === attempt.id)
      .map(edge => nodes.find(node => node.id === edge.target)).filter(node => node.x === undefined);
    const spread = Math.min(2.5, Math.max(1, 2 * Math.PI / attempts.length));
    children.forEach((node, i) => {
      const leafAngle = angle + (children.length === 1 ? 0 : i / (children.length - 1) - 0.5) * spread;
      const leafRadius = Math.max(190, children.length * 32);
      node.x = attempt.x + Math.cos(leafAngle) * leafRadius;
      node.y = attempt.y + Math.sin(leafAngle) * leafRadius;
    });
  });
  return { nodes, edges };
}
