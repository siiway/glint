export type MarkdownChecklistTodo = {
  title: string;
  completed: boolean;
  comments?: string[];
  children?: MarkdownChecklistTodo[];
};

export function parseMarkdownChecklist(md: string): MarkdownChecklistTodo[] {
  const lines = md.split("\n");
  const roots: MarkdownChecklistTodo[] = [];
  const stack: Array<{ indent: number; node: MarkdownChecklistTodo }> = [];

  for (const raw of lines) {
    const item = raw.match(/^(\s*)[-*]\s+\[([xX ])\]\s+(.+)$/);
    if (item) {
      const [, spaces, check, title] = item;
      const node: MarkdownChecklistTodo = {
        title: title.trim(),
        completed: check.toLowerCase() === "x",
      };

      const indent = spaces.length;
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const parent = stack[stack.length - 1]?.node;
      if (parent) {
        parent.children ??= [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }

      stack.push({ indent, node });
      continue;
    }

    const comment = raw.match(/^\s*>\s?(.*)$/);
    if (comment && stack.length > 0) {
      const current = stack[stack.length - 1].node;
      current.comments ??= [];
      current.comments.push(comment[1]);
    }
  }

  return roots;
}