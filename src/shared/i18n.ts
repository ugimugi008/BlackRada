import type { GamePhase, MafiaRole, NightStep } from './mafiaEngine';

export type Language = 'en' | 'uk';

export interface Translations {
  // Header & Entry
  navWebcam: string;
  navStudio: string;
  navHost: string;
  selfHostGuide: string;
  heroTitle: string;
  heroSubtitle: string;
  camMicCheck: string;
  optionalForPlay: string;
  camTurnedOff: string;
  camNotConnected: string;
  preview: string;
  micLive: string;
  muted: string;
  camOn: string;
  camOff: string;
  micOn: string;
  unmuteMic: string;
  turnCamOn: string;
  enableWebcam: string;
  connectCamera: string;
  noiseFilterOn: string;
  noiseFilterOff: string;
  noiseFilterShortOn: string;
  noiseFilterShortOff: string;
  hostAsMod: string;
  joinWithCode: string;
  yourNickname: string;
  nicknamePlaceholderHost: string;
  nicknamePlaceholderJoin: string;
  tableName: string;
  roomCode: string;
  connecting: string;
  createModRoom: string;
  joinGameTable: string;
  hostNote: string;
  playerNote: string;
  errEnterName: string;
  errEnterCode: string;

  // Room Topbar & Grid
  copyInvite: string;
  linkCopied: string;
  copyInviteLink: string;
  waitingTitle: string;
  waitingDesc: string;
  allSeats: string;
  aliveOnly: string;
  youSuffix: string;
  moderatorBadge: string;
  eliminatedBadge: string;
  reconnectingBadge: string;
  eyesClosed: string;
  camHiddenByMod: string;
  voteSingle: string;
  votePlural: string;

  // Bottom Dock
  micShort: string;
  camShort: string;
  controlsShort: string;
  roleShort: string;
  selfHostShort: string;
  leave: string;

  // Phases & Night Banners
  phaseLobby: string;
  phaseNight: string;
  phaseDay: string;
  phaseVoting: string;
  phaseEnded: string;
  townVictory: string;
  mafiaVictory: string;
  roundVictory: string;
  allRolesRevealed: string;
  votingOpenBanner: string;
  aliveCounter: string;
  nightStepBanner: Record<NightStep, string>;

  // Moderator Panel
  tabDirector: string;
  tabRoster: string;
  tabLog: string;
  phaseDirector: string;
  startNight: string;
  startDay: string;
  openVoting: string;
  resetLobby: string;
  nightSequence: string;
  nextStep: string;
  nightPicksHint: string;
  mafiaKillLabel: string;
  donCheckLabel: string;
  sheriffCheckLabel: string;
  doctorSaveLabel: string;
  noneOption: string;
  wakeTownResolve: string;
  activeVoteTally: string;
  votesCastOf: string;
  skipLabel: string;
  eliminateLeader: string;
  resolveVote: string;
  skipVote: string;
  discussionTimer: string;
  startTimer: string;
  pauseTimer: string;
  roleDeck: string;
  seatedSuffix: string;
  mafiaRegular: string;
  dealSecretRoles: string;
  revealAll: string;
  rosterHint: string;
  clearRoles: string;
  noSeatedYet: string;
  shareCodeHint: string;
  unassigned: string;
  aliveBtn: string;
  deadBtn: string;
  tableChat: string;
  mafiaWhisper: string;
  send: string;
  messagePlaceholder: string;

  // Player Side Panel
  yourSecretRole: string;
  peek: string;
  hide: string;
  waitingForRoles: string;
  roleHiddenMsg: string;
  mafiaTeamLabel: string;
  townTeamLabel: string;
  mafiaPartners: string;
  yourNightTurn: string;
  nightInProgressSleep: string;
  castVoteTitle: string;
  tableChatLog: string;

  // Tile Action Labels
  actionVote: string;
  actionTarget: string;
  actionProtect: string;
  actionInspect: string;

  // Roles
  roles: Record<
    MafiaRole,
    {
      label: string;
      shortDesc: string;
      nightPrompt: string;
    }
  >;

  // Host Guide Modal
  hostGuideTitle: string;
  hostGuideDesc: string;
  hostOption1Title: string;
  hostOption1Desc: string;
  hostOption2Title: string;
  hostOption2Desc: string;
  copy: string;
  copied: string;
  done: string;
  modStudioTitle: string;
  roleChatTitle: string;
}

export const TRANSLATIONS: Record<Language, Translations> = {
  en: {
    navWebcam: 'Webcam Table',
    navStudio: 'Moderator Studio',
    navHost: '7–16 Players & Phones',
    selfHostGuide: 'Self-Host Guide',
    heroTitle: 'Live webcam Mafia with a dedicated Moderator console',
    heroSubtitle:
      'Host a voice and video table for 7–16 friends on phones or laptops, rename players on the fly, deal secret roles, and direct every Night phase.',
    camMicCheck: 'Camera & Mic Check',
    optionalForPlay: 'Optional for play',
    camTurnedOff: 'Camera turned off',
    camNotConnected: 'Camera not connected yet',
    preview: 'Preview',
    micLive: 'Mic live',
    muted: 'Muted',
    camOn: 'Cam on',
    camOff: 'Cam off',
    micOn: 'Mic On',
    unmuteMic: 'Unmute Mic',
    turnCamOn: 'Turn Cam On',
    enableWebcam: 'Enable Webcam',
    connectCamera: 'Connect Camera',
    noiseFilterOn: 'Noise Filter On',
    noiseFilterOff: 'Noise Filter Off',
    noiseFilterShortOn: 'NC On',
    noiseFilterShortOff: 'NC Off',
    hostAsMod: 'Host as Moderator',
    joinWithCode: 'Join with Code',
    yourNickname: 'Your Nickname',
    nicknamePlaceholderHost: 'e.g. Alex (Host)',
    nicknamePlaceholderJoin: 'e.g. Jordan',
    tableName: 'Table Name',
    roomCode: 'Room Code',
    connecting: 'Connecting...',
    createModRoom: 'Create Moderator Room',
    joinGameTable: 'Join Game Table',
    hostNote:
      'Moderators sit outside the town roster, rename any player, deal or override secret roles, and step through each Night phase.',
    playerNote:
      'Your secret role stays private to your screen. The Moderator can adjust your nickname and seat order.',
    errEnterName: 'Enter a nickname before entering the table.',
    errEnterCode: 'Enter the 6-character room code from your Moderator.',

    copyInvite: 'Copy Invite',
    linkCopied: 'Link Copied',
    copyInviteLink: 'Copy Invite Link',
    waitingTitle: 'Waiting for players to take seats',
    waitingDesc: 'Share code {code} or copy the invite link so friends can join with their webcams.',
    allSeats: 'All Seats',
    aliveOnly: 'Alive Only',
    youSuffix: 'You',
    moderatorBadge: 'Moderator',
    eliminatedBadge: 'Eliminated',
    reconnectingBadge: 'Reconnecting',
    eyesClosed: 'Eyes closed',
    camHiddenByMod: 'Cam hidden by Mod',
    voteSingle: 'vote',
    votePlural: 'votes',

    micShort: 'Mic',
    camShort: 'Cam',
    controlsShort: 'Controls',
    roleShort: 'Role',
    selfHostShort: 'Self-Host',
    leave: 'Leave',

    phaseLobby: 'Lobby',
    phaseNight: 'Night',
    phaseDay: 'Day',
    phaseVoting: 'Voting',
    phaseEnded: 'Round Complete',
    townVictory: 'Town Victory',
    mafiaVictory: 'Mafia Victory',
    roundVictory: 'Round Complete',
    allRolesRevealed: 'All roles revealed',
    votingOpenBanner: 'Voting open — Tap Vote on a player tile or in the side panel',
    aliveCounter: 'Alive',
    nightStepBanner: {
      SLEEP: 'Town is asleep',
      MAFIA: 'Mafia awake',
      DON: 'Don checking Sheriff',
      SHERIFF: 'Sheriff investigating',
      DOCTOR: 'Doctor protecting',
      RESOLVE: 'Ready to wake town',
    },

    tabDirector: 'Director',
    tabRoster: 'Roster',
    tabLog: 'Log',
    phaseDirector: 'Phase Director',
    startNight: 'Start Night',
    startDay: 'Start Day',
    openVoting: 'Open Voting',
    resetLobby: 'Reset Lobby',
    nightSequence: 'Night {n} Sequence',
    nextStep: 'Next Step',
    nightPicksHint: 'Night picks (updates live as awake players select, or set manually):',
    mafiaKillLabel: 'Mafia Kill',
    donCheckLabel: 'Don Check',
    sheriffCheckLabel: 'Sheriff Check',
    doctorSaveLabel: 'Doctor Save',
    noneOption: 'None',
    wakeTownResolve: 'Wake Town & Resolve Night',
    activeVoteTally: 'Active Vote Tally',
    votesCastOf: '{cast} of {total} alive players voted',
    skipLabel: 'Skip',
    eliminateLeader: 'Eliminate Leader',
    resolveVote: 'Resolve Vote',
    skipVote: 'Skip Vote',
    discussionTimer: 'Discussion Timer',
    startTimer: 'Start',
    pauseTimer: 'Pause',
    roleDeck: 'Role Deck ({n} seated)',
    seatedSuffix: 'seated',
    mafiaRegular: 'Mafia (Regular)',
    dealSecretRoles: 'Deal Secret Roles',
    revealAll: 'Reveal All',
    rosterHint: 'Click pencil to rename or select role',
    clearRoles: 'Clear roles',
    noSeatedYet: 'No seated players yet',
    shareCodeHint: 'Share the room code {code} or invite link with your friends.',
    unassigned: 'Unassigned',
    aliveBtn: 'Alive',
    deadBtn: 'Dead',
    tableChat: 'Table Chat',
    mafiaWhisper: 'Mafia Whisper',
    send: 'Send',
    messagePlaceholder: 'Send a message...',

    yourSecretRole: 'Your Secret Role',
    peek: 'Peek',
    hide: 'Hide',
    waitingForRoles: 'Waiting for the Moderator to deal roles.',
    roleHiddenMsg: 'Role hidden to protect your screen. Tap Peek to view.',
    mafiaTeamLabel: 'Mafia Team',
    townTeamLabel: 'Town Team',
    mafiaPartners: 'Mafia partners',
    yourNightTurn: 'Your Night Turn',
    nightInProgressSleep: 'Night {n} in progress. Keep your eyes closed until morning.',
    castVoteTitle: 'Cast Vote',
    tableChatLog: 'Table Chat & Log',

    actionVote: 'Vote',
    actionTarget: 'Target',
    actionProtect: 'Protect',
    actionInspect: 'Inspect',

    roles: {
      mafia: {
        label: 'Mafia',
        shortDesc: 'Eliminate town members under cover of night and blend in during the day.',
        nightPrompt: 'Choose a town member to eliminate tonight.',
      },
      don: {
        label: 'Mafia Don',
        shortDesc: 'Leads the Mafia kill and can inspect one player each night to find the Sheriff.',
        nightPrompt: 'Coordinate the Mafia kill and inspect a player to locate the Sheriff.',
      },
      sheriff: {
        label: 'Sheriff',
        shortDesc: 'Investigate one player each night to learn whether they belong to the Mafia.',
        nightPrompt: 'Select one player to investigate tonight.',
      },
      doctor: {
        label: 'Doctor',
        shortDesc: 'Protect one player each night from being eliminated by the Mafia.',
        nightPrompt: 'Select one player to protect tonight.',
      },
      villager: {
        label: 'Townsperson',
        shortDesc: 'Observe discussions, spot contradictions, and vote out Mafia during the day.',
        nightPrompt: 'Rest quietly until morning.',
      },
    },

    hostGuideTitle: 'Self-Host on Demand (7–16 Players)',
    hostGuideDesc:
      'Spin up a private game server with LiveKit SFU video scaling and close it when game night ends.',
    hostOption1Title: 'Option 1: Docker + LiveKit SFU + HTTPS link',
    hostOption1Desc:
      'Runs the app, built-in LiveKit SFU for 7–16 phones, and a temporary Cloudflare HTTPS URL.',
    hostOption2Title: 'Option 2: LiveKit Cloud + Node.js',
    hostOption2Desc:
      'Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in .env and run anywhere on port 3000.',
    copy: 'Copy',
    copied: 'Copied',
    done: 'Done',
    modStudioTitle: 'Moderator Studio',
    roleChatTitle: 'Role & Chat',
  },
  uk: {
    navWebcam: 'Відеостіл',
    navStudio: 'Пульт Ведучого',
    navHost: '7–16 гравців і телефони',
    selfHostGuide: 'Як запустити',
    heroTitle: 'Онлайн-Мафія з вебкамерами та окремим пультом Ведучого',
    heroSubtitle:
      'Збирайте друзів на 7–16 гравців з телефонів чи комп’ютерів, змінюйте нікнейми на льоту, роздавайте таємні ролі й керуйте кожною Ніччю.',
    camMicCheck: 'Перевірка камери та мікрофона',
    optionalForPlay: 'Необов’язково для входу',
    camTurnedOff: 'Камеру вимкнено',
    camNotConnected: 'Камера ще не підключена',
    preview: 'Перегляд',
    micLive: 'Мікрофон увімк.',
    muted: 'Без звуку',
    camOn: 'Камера увімк.',
    camOff: 'Камера вимк.',
    micOn: 'Мікрофон',
    unmuteMic: 'Увімк. звук',
    turnCamOn: 'Увімк. камеру',
    enableWebcam: 'Увімкнути камеру',
    connectCamera: 'Підкл. камеру',
    noiseFilterOn: 'Шумодав увімк.',
    noiseFilterOff: 'Шумодав вимк.',
    noiseFilterShortOn: 'Шумодав',
    noiseFilterShortOff: 'Без ШП',
    hostAsMod: 'Створити (Ведучий)',
    joinWithCode: 'Увійти за кодом',
    yourNickname: 'Ваш нікнейм',
    nicknamePlaceholderHost: 'напр. Олексій (Ведучий)',
    nicknamePlaceholderJoin: 'напр. Дарина',
    tableName: 'Назва столу',
    roomCode: 'Код кімнати',
    connecting: 'Підключення...',
    createModRoom: 'Створити кімнату Ведучого',
    joinGameTable: 'Приєднатися до столу',
    hostNote:
      'Ведучий сидить окремо від гравців, змінює нікнейми, роздає чи коригує ролі та запускає кожен етап Ночі.',
    playerNote:
      'Ваша таємна роль видна лише вам. Ведучий може змінювати ваш нікнейм і порядок місць.',
    errEnterName: 'Введіть нікнейм перед входом за стіл.',
    errEnterCode: 'Введіть 6-символьний код кімнати від Ведучого.',

    copyInvite: 'Запросити',
    linkCopied: 'Скопійовано',
    copyInviteLink: 'Скопіювати посилання',
    waitingTitle: 'Очікуємо гравців за столом',
    waitingDesc: 'Поділіться кодом {code} або посиланням, щоб друзі підключилися з камерами.',
    allSeats: 'Усі місця',
    aliveOnly: 'Тільки живі',
    youSuffix: 'Ви',
    moderatorBadge: 'Ведучий',
    eliminatedBadge: 'Вибув',
    reconnectingBadge: 'Перепідкл.',
    eyesClosed: 'Очі заплющені',
    camHiddenByMod: 'Сховано Ведучим',
    voteSingle: 'голос',
    votePlural: 'голоси',

    micShort: 'Звук',
    camShort: 'Кам.',
    controlsShort: 'Пульт',
    roleShort: 'Роль',
    selfHostShort: 'Хостинг',
    leave: 'Вийти',

    phaseLobby: 'Лобі',
    phaseNight: 'Ніч',
    phaseDay: 'День',
    phaseVoting: 'Голосування',
    phaseEnded: 'Гру завершено',
    townVictory: 'Перемога Мирних',
    mafiaVictory: 'Перемога Мафії',
    roundVictory: 'Раунд завершено',
    allRolesRevealed: 'Усі ролі відкрито',
    votingOpenBanner: 'Голосування відкрито — натисніть «Голос» на плитці гравця або в панелі',
    aliveCounter: 'Живі',
    nightStepBanner: {
      SLEEP: 'Місто засинає',
      MAFIA: 'Прокидається Мафія',
      DON: 'Хід Дона',
      SHERIFF: 'Хід Шерифа',
      DOCTOR: 'Хід Лікаря',
      RESOLVE: 'Готово до ранку',
    },

    tabDirector: 'Хід гри',
    tabRoster: 'Гравці',
    tabLog: 'Журнал',
    phaseDirector: 'Керування фазами',
    startNight: 'Почати Ніч',
    startDay: 'Почати День',
    openVoting: 'Голосування',
    resetLobby: 'Скинути лобі',
    nightSequence: 'Ніч {n}: етапи',
    nextStep: 'Далі',
    nightPicksHint: 'Нічні вибори (оновлюються наживо або оберіть вручну):',
    mafiaKillLabel: 'Постріл Мафії',
    donCheckLabel: 'Перевірка Дона',
    sheriffCheckLabel: 'Перевірка Шерифа',
    doctorSaveLabel: 'Порятунок Лікаря',
    noneOption: 'Немає',
    wakeTownResolve: 'Розбудити місто',
    activeVoteTally: 'Підрахунок голосів',
    votesCastOf: 'Проголосувало {cast} із {total} живих',
    skipLabel: 'Пропуск',
    eliminateLeader: 'Вигнати лідера',
    resolveVote: 'Завершити голос.',
    skipVote: 'Пропустити',
    discussionTimer: 'Таймер обговорення',
    startTimer: 'Старт',
    pauseTimer: 'Пауза',
    roleDeck: 'Колода ролей ({n} за столом)',
    seatedSuffix: 'гравців',
    mafiaRegular: 'Мафія (звичайна)',
    dealSecretRoles: 'Роздати ролі',
    revealAll: 'Відкрити всі',
    rosterHint: 'Натисніть олівець, щоб змінити нік чи роль',
    clearRoles: 'Очистити ролі',
    noSeatedYet: 'Ще немає гравців за столом',
    shareCodeHint: 'Надішліть код {code} або посилання друзям.',
    unassigned: 'Без ролі',
    aliveBtn: 'Живий',
    deadBtn: 'Вибув',
    tableChat: 'Стіл',
    mafiaWhisper: 'Чат Мафії',
    send: 'Надіслати',
    messagePlaceholder: 'Написати повідомлення...',

    yourSecretRole: 'Ваша таємна роль',
    peek: 'Показати',
    hide: 'Сховати',
    waitingForRoles: 'Очікуємо, поки Ведучий роздасть ролі.',
    roleHiddenMsg: 'Роль приховано для безпеки екрана. Натисніть «Показати».',
    mafiaTeamLabel: 'Команда Мафії',
    townTeamLabel: 'Команда Міста',
    mafiaPartners: 'Спільники Мафії',
    yourNightTurn: 'Ваш нічний хід',
    nightInProgressSleep: 'Триває Ніч {n}. Тримайте очі заплющеними до ранку.',
    castVoteTitle: 'Голосування',
    tableChatLog: 'Чат столу та події',

    actionVote: 'Голос',
    actionTarget: 'Ціль',
    actionProtect: 'Лікувати',
    actionInspect: 'Перевірити',

    roles: {
      mafia: {
        label: 'Мафія',
        shortDesc: 'Усувайте мирних жителів уночі та приховуйте свою роль удень.',
        nightPrompt: 'Оберіть гравця, якого Мафія усуне цієї ночі.',
      },
      don: {
        label: 'Дон Мафії',
        shortDesc: 'Очолює Мафію та щоночі може перевірити одного гравця на роль Шерифа.',
        nightPrompt: 'Координуйте постріл Мафії та перевірте гравця на Шерифа.',
      },
      sheriff: {
        label: 'Шериф',
        shortDesc: 'Щоночі перевіряйте одного гравця, щоб дізнатися, чи належить він до Мафії.',
        nightPrompt: 'Оберіть гравця для нічної перевірки.',
      },
      doctor: {
        label: 'Лікар',
        shortDesc: 'Щоночі рятуйте одного гравця від пострілу Мафії.',
        nightPrompt: 'Оберіть гравця, якого захистите цієї ночі.',
      },
      villager: {
        label: 'Мирний житель',
        shortDesc: 'Спостерігайте за обговоренням, шукайте суперечності та голосуйте проти Мафії.',
        nightPrompt: 'Відпочивайте спокійно до ранку.',
      },
    },

    hostGuideTitle: 'Власний запуск (7–16 гравців)',
    hostGuideDesc:
      'Запустіть приватний сервер із LiveKit SFU для стабільного відео на телефонах та вимкніть після гри.',
    hostOption1Title: 'Варіант 1: Docker + LiveKit SFU + HTTPS-посилання',
    hostOption1Desc:
      'Запускає гру, медіасервер LiveKit для 7–16 телефонів і тимчасовий HTTPS-тунель Cloudflare.',
    hostOption2Title: 'Варіант 2: LiveKit Cloud + Node.js',
    hostOption2Desc:
      'Додайте LIVEKIT_URL, LIVEKIT_API_KEY і LIVEKIT_API_SECRET у .env та запустіть на порту 3000.',
    copy: 'Копіювати',
    copied: 'Скопійовано',
    done: 'Готово',
    modStudioTitle: 'Пульт Ведучого',
    roleChatTitle: 'Роль і чат',
  },
};

export function formatPhaseLabel(
  t: Translations,
  phase: GamePhase,
  nightNumber: number,
  dayNumber: number
): string {
  if (phase === 'LOBBY') return t.phaseLobby;
  if (phase === 'NIGHT') return `${t.phaseNight} ${nightNumber}`;
  if (phase === 'VOTING') return `${t.phaseDay} ${dayNumber} · ${t.phaseVoting}`;
  if (phase === 'ENDED') return t.phaseEnded;
  return `${t.phaseDay} ${dayNumber}`;
}
