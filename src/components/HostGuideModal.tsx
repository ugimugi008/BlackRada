import { Check, Copy, Server, Terminal, X } from 'lucide-react';
import { useState } from 'react';
import type { Translations } from '../shared/i18n';

interface HostGuideModalProps {
  open: boolean;
  t: Translations;
  onClose: () => void;
}

export function HostGuideModal({ open, t, onClose }: HostGuideModalProps) {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!open) return null;

  const copyCommand = (id: string, cmd: string) => {
    navigator.clipboard?.writeText(cmd).catch(() => {});
    setCopiedCmd(id);
    window.setTimeout(() => setCopiedCmd(null), 1800);
  };

  const dockerCmd = 'docker compose --profile sfu --profile tunnel up --build';
  const nodeCmd = 'npm install && npm run build && npm start';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="host-guide-title"
    >
      <div className="w-full max-w-xl rounded-xl border border-white/10 bg-[#161920] p-6 text-[#F3F4F6] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 id="host-guide-title" className="text-lg font-bold tracking-tight">
              {t.hostGuideTitle}
            </h2>
            <p className="mt-1 text-sm text-[#9CA3AF]">{t.hostGuideDesc}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close self-hosting guide"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-[#9CA3AF] transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Server className="h-4 w-4 text-[#5865F2]" />
              <span>{t.hostOption1Title}</span>
            </div>
            <p className="mt-1 text-xs text-[#9CA3AF]">{t.hostOption1Desc}</p>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#0F1115] px-3 py-2.5">
              <code className="overflow-x-auto font-mono text-xs text-[#E5E7EB]">
                {dockerCmd}
              </code>
              <button
                type="button"
                onClick={() => copyCommand('docker', dockerCmd)}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10"
              >
                {copiedCmd === 'docker' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#10B981]" />
                    <span>{t.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>{t.copy}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Terminal className="h-4 w-4 text-[#5865F2]" />
              <span>{t.hostOption2Title}</span>
            </div>
            <p className="mt-1 text-xs text-[#9CA3AF]">{t.hostOption2Desc}</p>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#0F1115] px-3 py-2.5">
              <code className="overflow-x-auto font-mono text-xs text-[#E5E7EB]">
                {nodeCmd}
              </code>
              <button
                type="button"
                onClick={() => copyCommand('node', nodeCmd)}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10"
              >
                {copiedCmd === 'node' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#10B981]" />
                    <span>{t.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>{t.copy}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4752C4]"
          >
            {t.done}
          </button>
        </div>
      </div>
    </div>
  );
}
