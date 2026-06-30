import type { Tool } from '../tools/registry'
import ToolKindBadge from './ToolKindBadge'

interface ToolPageHeaderProps {
  tool: Pick<Tool, 'name' | 'description' | 'kind'>
}

export default function ToolPageHeader({ tool }: ToolPageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{tool.name}</h1>
        <ToolKindBadge kind={tool.kind} className="text-xs px-2 py-1" />
      </div>
      {tool.description && (
        <p className="text-[var(--color-text-secondary)] mt-1">{tool.description}</p>
      )}
      <p className="text-xs text-[var(--color-text-muted)] mt-2">
        {tool.kind === 'remote'
          ? 'This tool sends queries to the NetKnife AWS backend.'
          : 'This tool runs locally in your browser — no data leaves your device.'}
      </p>
    </div>
  )
}
