import { AudioLines, Camera, CameraOff, Mic, MicOff, Server, Shield, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Language, Translations } from '../shared/i18n';
import BrandLogo from './BrandLogo';

interface JoinScreenProps {
  lang: Language;
  t: Translations;
  onChangeLang: (lang: Language) => void;
  initialRoomCode: string;
  localStream: MediaStream | null;
  micMuted: boolean;
  camOff: boolean;
  noiseFilterEnabled: boolean;
  mediaError: string | null;
  connecting: boolean;
  errorMessage: string | null;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleNoiseFilter: () => void;
  onRequestMedia: () => void;
  onCreateRoom: (nickname: string, roomName: string) => void;
  onJoinRoom: (code: string, nickname: string) => void;
  onOpenHostGuide: () => void;
}

export function JoinScreen({
  lang,
  t,
  onChangeLang,
  initialRoomCode,
  localStream,
  micMuted,
  camOff,
  noiseFilterEnabled,
  mediaError,
  connecting,
  errorMessage,
  onToggleMic,
  onToggleCam,
  onToggleNoiseFilter,
  onRequestMedia,
  onCreateRoom,
  onJoinRoom,
  onOpenHostGuide,
}: JoinScreenProps) {
  const [mode, setMode] = useState<'host' | 'join'>(initialRoomCode ? 'join' : 'host');
  const [nickname, setNickname] = useState('');
  const [roomName, setRoomName] = useState('Friday Night Mafia');
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [validationError, setValidationError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = localStream && !camOff ? localStream : null;
    }
  }, [localStream, camOff]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = nickname.trim();
    if (!trimmedName) {
      setValidationError(t.errEnterName);
      return;
    }
    if (mode === 'join') {
      const cleanedCode = roomCode.trim().toUpperCase();
      if (cleanedCode.length < 4) {
        setValidationError(t.errEnterCode);
        return;
      }
      setValidationError(null);
      onJoinRoom(cleanedCode, trimmedName);
    } else {
      setValidationError(null);
      onCreateRoom(trimmedName, roomName.trim() || 'Friday Night Mafia');
    }
  };

  const displayInitial = (nickname.trim()[0] || 'M').toUpperCase();

  return (
    <div className="min-h-screen bg-[#0F1115] text-[#F3F4F6] flex flex-col">
      <header className="border-b border-white/10 bg-[#13161C]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3.5 sm:gap-8 sm:px-6">
          <BrandLogo />
          <nav className="hidden lg:flex items-center gap-6 text-sm text-[#9CA3AF]">
            <span className="whitespace-nowrap shrink-0">{t.navWebcam}</span>
            <span aria-hidden="true" className="text-white/20">/</span>
            <span className="whitespace-nowrap shrink-0">{t.navStudio}</span>
            <span aria-hidden="true" className="text-white/20">/</span>
            <span className="whitespace-nowrap shrink-0">{t.navHost}</span>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label="Language switcher"
              className="flex items-center rounded-lg border border-white/15 bg-[#0F1115] p-0.5"
            >
              <button
                type="button"
                onClick={() => onChangeLang('uk')}
                aria-pressed={lang === 'uk'}
                className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
                  lang === 'uk' ? 'bg-[#5865F2] text-white' : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                UA
              </button>
              <button
                type="button"
                onClick={() => onChangeLang('en')}
                aria-pressed={lang === 'en'}
                className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
                  lang === 'en' ? 'bg-[#5865F2] text-white' : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                EN
              </button>
            </div>
            <button
              type="button"
              onClick={onOpenHostGuide}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/10 whitespace-nowrap shrink-0"
            >
              <Server className="h-3.5 w-3.5 text-[#5865F2]" />
              <span className="hidden sm:inline">{t.selfHostGuide}</span>
              <span className="sm:hidden">{t.selfHostShort}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 max-w-2xl sm:mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl [text-wrap:balance]">
            {t.heroTitle}
          </h1>
          <p className="mt-2 text-sm text-[#9CA3AF] sm:text-base">{t.heroSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12 lg:gap-8">
          {/* Left: Camera / Mic Check */}
          <section
            aria-label={t.camMicCheck}
            className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#161920] p-4 sm:p-5 lg:col-span-6"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">{t.camMicCheck}</h2>
                <span className="text-xs text-[#9CA3AF]">{t.optionalForPlay}</span>
              </div>

              <div className="relative mt-3.5 aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-[#0B0D11]">
                {localStream && !camOff ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full -scale-x-100 object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-[#1E222B] text-2xl font-bold text-white">
                      {displayInitial}
                    </div>
                    <p className="text-xs text-[#9CA3AF]">
                      {camOff ? t.camTurnedOff : t.camNotConnected}
                    </p>
                  </div>
                )}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/30 to-transparent px-3.5 py-2.5">
                  <span className="text-xs font-medium text-white">
                    {nickname.trim() || t.preview}
                  </span>
                  <span className="text-xs text-[#D1D5DB]">
                    {micMuted ? t.muted : t.micLive} · {camOff ? t.camOff : t.camOn}
                  </span>
                </div>
              </div>

              {mediaError && (
                <p className="mt-3 text-xs text-amber-300" role="status">
                  {mediaError}
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={onToggleMic}
                className={`flex h-10 items-center gap-2 rounded-lg border px-3.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  micMuted
                    ? 'border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
                    : 'border-white/10 bg-[#1E222B] text-white hover:bg-white/10'
                }`}
              >
                {micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 text-[#10B981]" />}
                <span>{micMuted ? t.unmuteMic : t.micOn}</span>
              </button>

              <button
                type="button"
                onClick={onToggleCam}
                className={`flex h-10 items-center gap-2 rounded-lg border px-3.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  camOff
                    ? 'border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
                    : 'border-white/10 bg-[#1E222B] text-white hover:bg-white/10'
                }`}
              >
                {camOff ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4 text-[#10B981]" />}
                <span>{camOff ? t.turnCamOn : t.camOn}</span>
              </button>

              <button
                type="button"
                onClick={onToggleNoiseFilter}
                aria-pressed={noiseFilterEnabled}
                className={`flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  noiseFilterEnabled
                    ? 'border-[#10B981]/40 bg-[#10B981]/15 text-emerald-200 hover:bg-[#10B981]/25'
                    : 'border-white/10 bg-[#1E222B] text-[#9CA3AF] hover:text-white'
                }`}
              >
                <AudioLines className="h-4 w-4" />
                <span>{noiseFilterEnabled ? t.noiseFilterOn : t.noiseFilterOff}</span>
              </button>

              {!localStream && (
                <button
                  type="button"
                  onClick={onRequestMedia}
                  className="ml-auto flex h-10 items-center rounded-lg border border-[#5865F2]/40 bg-[#5865F2]/15 px-3.5 text-xs font-semibold text-[#C7D2FE] transition-colors hover:bg-[#5865F2]/25 whitespace-nowrap shrink-0"
                >
                  {t.enableWebcam}
                </button>
              )}
            </div>
          </section>

          {/* Right: Host / Join Form */}
          <section
            aria-label={t.joinGameTable}
            className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#161920] p-5 sm:p-6 lg:col-span-6"
          >
            <div>
              <div
                role="tablist"
                aria-label="Entry mode"
                className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-[#0F1115] p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'host'}
                  onClick={() => {
                    setMode('host');
                    setValidationError(null);
                  }}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                    mode === 'host'
                      ? 'bg-[#5865F2] text-white'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t.hostAsMod}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'join'}
                  onClick={() => {
                    setMode('join');
                    setValidationError(null);
                  }}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                    mode === 'join'
                      ? 'bg-[#5865F2] text-white'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t.joinWithCode}</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="nickname-input" className="block text-xs font-semibold text-[#D1D5DB]">
                    {t.yourNickname}
                  </label>
                  <input
                    id="nickname-input"
                    type="text"
                    maxLength={24}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder={mode === 'host' ? t.nicknamePlaceholderHost : t.nicknamePlaceholderJoin}
                    className="mt-1.5 h-11 w-full rounded-lg border border-white/15 bg-[#0F1115] px-3.5 text-sm text-white placeholder-[#6B7280] focus:border-[#5865F2] focus:outline-none"
                  />
                </div>

                {mode === 'host' ? (
                  <div>
                    <label htmlFor="room-name-input" className="block text-xs font-semibold text-[#D1D5DB]">
                      {t.tableName}
                    </label>
                    <input
                      id="room-name-input"
                      type="text"
                      maxLength={24}
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="Friday Night Mafia"
                      className="mt-1.5 h-11 w-full rounded-lg border border-white/15 bg-[#0F1115] px-3.5 text-sm text-white placeholder-[#6B7280] focus:border-[#5865F2] focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="room-code-input" className="block text-xs font-semibold text-[#D1D5DB]">
                      {t.roomCode}
                    </label>
                    <input
                      id="room-code-input"
                      type="text"
                      maxLength={8}
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      placeholder="ABC123"
                      className="mt-1.5 h-11 w-full rounded-lg border border-white/15 bg-[#0F1115] px-3.5 font-mono text-sm tracking-widest text-white uppercase placeholder-[#6B7280] focus:border-[#5865F2] focus:outline-none"
                    />
                  </div>
                )}

                {(validationError || errorMessage) && (
                  <p className="text-xs font-medium text-rose-400" role="alert">
                    {validationError || errorMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={connecting}
                  className="mt-2 flex h-11 w-full items-center justify-center rounded-lg bg-[#5865F2] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#4752C4] disabled:opacity-50"
                >
                  {connecting
                    ? t.connecting
                    : mode === 'host'
                    ? t.createModRoom
                    : t.joinGameTable}
                </button>
              </form>
            </div>

            <div className="mt-5 border-t border-white/10 pt-4 text-xs text-[#9CA3AF]">
              <p>{mode === 'host' ? t.hostNote : t.playerNote}</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
