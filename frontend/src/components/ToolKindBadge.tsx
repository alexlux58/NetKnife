import type { ToolKind } from '../tools/registry'

interface ToolKindBadgeProps {
  kind: ToolKind
  className?: string
}

export default function ToolKindBadge({ kind, className = '' }: ToolKindBadgeProps) {
  const isRemote = kind === 'remote'
  return (
    <span
      className={`text-[10px] sm:text-xs font-medium px-1.5 py-0.5 rounded ${
        isRemote
          ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400'
          : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
      } ${className}`}
      title={isRemote ? 'Data is sent to AWS backend' : 'Runs entirely in your browser'}
    >
      {isRemote ? 'AWS' : 'LOCAL'}
    </span>
  )
}
