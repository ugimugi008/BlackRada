import { AudioLines, Camera, CameraOff, ImagePlus, Loader2, Mic, MicOff, Server, Shield, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Language, Translations } from '../shared/i18n';
import BrandLogo from './BrandLogo';
import { uploadAvatar } from '../avatarChoice';
import { PRESET_AVATARS, avatarSrc, sameAvatar, type Avatar } from '../shared/avatars';

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
  /** Your avatar (shown when your camera is off); null = your initial letter. */
  avatar: Avatar | null;
  onChangeAvatar: (avatar: Avatar | null) => void;
  onCreateRoom: (nickname: string, roomName: string) => void;
  onJoinRoom: (code: string, nickname: string) => void;
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
  avatar,
  onChangeAvatar,
  onCreateRoom,
  onJoinRoom,
}: JoinScreenProps) {
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const myAvatarSrc = avatarSrc(avatar);

  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError(null);
    setUploading(true);
    try {
      onChangeAvatar(await uploadAvatar(file));
    } catch {
      setAvatarError(t.avatarUploadFailed);
    } finally {
      setUploading(false);
    }
  };
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
                    {myAvatarSrc ? (
                      <img
                        src={myAvatarSrc}
                        alt=""
                        className="h-20 w-20 rounded-full object-cover ring-2 ring-white/15"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-[#1E222B] text-2xl font-bold text-white">
                        {displayInitial}
                      </div>
                    )}
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

            {/* Avatar strip: your current avatar (tap to upload any picture) + ready-made ones */}
            <div className="mt-4" data-testid="avatar-strip">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label={t.avatarUpload}
                  title={t.avatarUpload}
                  className="relative h-12 w-12 shrink-0 rounded-full border border-dashed border-white/25 bg-[#0F1115] text-[#9CA3AF] transition-colors hover:border-[#5865F2] hover:text-white disabled:opacity-60"
                >
                  {myAvatarSrc ? (
                    <img src={myAvatarSrc} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-bold">
                      {displayInitial}
                    </span>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#171A21] bg-[#5865F2] text-white">
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                  </span>
                </button>
                <div className="h-8 w-px bg-white/10" />
                <div className="flex items-center gap-2">
                  {PRESET_AVATARS.map((p) => {
                    const choice: Avatar = { kind: 'preset', id: p.id };
                    const selected = sameAvatar(avatar, choice);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onChangeAvatar(selected ? null : choice)}
                        aria-label={p.label}
                        aria-pressed={selected}
                        title={p.label}
                        className={`h-10 w-10 overflow-hidden rounded-full transition ${
                          selected
                            ? 'ring-2 ring-[#5865F2] ring-offset-2 ring-offset-[#171A21]'
                            : 'opacity-80 ring-1 ring-white/10 hover:opacity-100'
                        }`}
                      >
                        <img src={p.src} alt="" className="h-full w-full object-cover" />
                      </button>
                    );
                  })}
                </div>
                <span className="ml-auto hidden text-right text-[11px] leading-tight text-[#6B7280] sm:block">
                  {t.avatarHint}
                </span>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePickFile} />
              {avatarError && (
                <p className="mt-2 text-xs text-rose-400" role="alert">
                  {avatarError}
                </p>
              )}
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
