export function CodeBlock({ title, children }: { title?: string; children: string }) {
  return (
    <div className="code">
      {title && <div className="code__title">{title}</div>}
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
}
