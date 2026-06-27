// 狼人杀角色/板子配置 + AI 主持多语言旁白模板 + 角色术语表 + AI 玩家台词。
// 主持旁白与角色名走「确定性本地化字符串表」（PRD §4.2：固定流程模板化，零幻觉、低延迟）；
// 玩家与 AI 玩家的发言走 TranslationEngine.translate（MT），见 service。
import type { WolfRole, WolfCamp } from '@linku/shared';

export const ROLE_CAMP: Record<WolfRole, WolfCamp> = {
  WOLF: 'WOLF',
  SEER: 'GOOD',
  WITCH: 'GOOD',
  HUNTER: 'GOOD',
  VILLAGER: 'GOOD',
};

// 支持的主持/角色本地化语言；其余语言回退 en。玩家发言不受此限（走 MT）。
const FALLBACK = 'en';

interface RoleText { name: string; desc: string }
type RoleI18n = Record<WolfRole, RoleText>;

const ROLE_I18N: Record<string, RoleI18n> = {
  en: {
    WOLF: { name: 'Werewolf', desc: 'Each night, vote with your pack to kill one player. Blend in by day.' },
    SEER: { name: 'Seer', desc: 'Each night, check one player to learn if they are a Werewolf.' },
    WITCH: { name: 'Witch', desc: 'You have one Antidote (save the night victim) and one Poison — one use each, all game.' },
    HUNTER: { name: 'Hunter', desc: 'When you die (except by poison), you may shoot one player.' },
    VILLAGER: { name: 'Villager', desc: 'No power. Use your words and votes to find the wolves.' },
  },
  zh: {
    WOLF: { name: '狼人', desc: '每晚与同伴投票刀掉一名玩家，白天伪装隐藏。' },
    SEER: { name: '预言家', desc: '每晚查验一名玩家，得知其是否为狼人。' },
    WITCH: { name: '女巫', desc: '有一瓶解药（救当晚被刀者）和一瓶毒药，全局各 1 次。' },
    HUNTER: { name: '猎人', desc: '死亡时（被毒除外）可开枪带走一名玩家。' },
    VILLAGER: { name: '平民', desc: '没有技能，靠发言和投票找出狼人。' },
  },
  es: {
    WOLF: { name: 'Hombre Lobo', desc: 'Cada noche, vota con tu manada para matar a un jugador. Disimula de día.' },
    SEER: { name: 'Vidente', desc: 'Cada noche, revisa a un jugador para saber si es Hombre Lobo.' },
    WITCH: { name: 'Bruja', desc: 'Tienes un Antídoto (salva a la víctima) y un Veneno; un uso cada uno en toda la partida.' },
    HUNTER: { name: 'Cazador', desc: 'Al morir (salvo por veneno), puedes disparar a un jugador.' },
    VILLAGER: { name: 'Aldeano', desc: 'Sin poder. Usa tus palabras y votos para hallar a los lobos.' },
  },
  ar: {
    WOLF: { name: 'المستذئب', desc: 'كل ليلة صوّت مع قطيعك لقتل لاعب. تخفّ بين الناس نهارًا.' },
    SEER: { name: 'العرّاف', desc: 'كل ليلة افحص لاعبًا لتعرف إن كان مستذئبًا.' },
    WITCH: { name: 'الساحرة', desc: 'لديك ترياق (لإنقاذ ضحية الليلة) وسمّ، مرة واحدة لكل منهما طوال اللعبة.' },
    HUNTER: { name: 'الصياد', desc: 'عند موتك (إلا بالسمّ) يمكنك إطلاق النار على لاعب.' },
    VILLAGER: { name: 'القروي', desc: 'لا قدرة لديك. استخدم كلامك وتصويتك لكشف الذئاب.' },
  },
};

export function roleText(lang: string, role: WolfRole): RoleText {
  return (ROLE_I18N[lang] ?? ROLE_I18N[FALLBACK])[role];
}

// ---------- 主持旁白模板 ----------
export type HostKey =
  | 'game_start'
  | 'night_fall'
  | 'wolves_wake'
  | 'seer_wake'
  | 'witch_wake'
  | 'day_break'
  | 'deaths'
  | 'no_death'
  | 'speak_start'
  | 'speaker_turn'
  | 'vote_start'
  | 'exiled'
  | 'no_exile'
  | 'hunter_fires'
  | 'wolves_win'
  | 'good_win';

const HOST_I18N: Record<string, Record<HostKey, string>> = {
  en: {
    game_start: 'The game begins on board "{board}". {count} players take their seats.',
    night_fall: 'Night {day} falls. Everyone, close your eyes.',
    wolves_wake: 'Werewolves, open your eyes and choose your prey.',
    seer_wake: 'Seer, open your eyes. Who do you wish to check?',
    witch_wake: 'Witch, open your eyes. Will you save or poison?',
    day_break: 'Day {day} breaks. The town awakens.',
    deaths: 'Last night, we lost: {names}.',
    no_death: 'A peaceful night — no one died.',
    speak_start: 'Discussion begins. Speak in turn — only the current speaker has the mic.',
    speaker_turn: 'Seat {seat} ({name}) has the floor.',
    vote_start: 'Voting time. Choose who to exile.',
    exiled: 'The town exiles Seat {seat} ({name}).',
    no_exile: 'The vote is tied — no one is exiled.',
    hunter_fires: 'The Hunter fires and takes down Seat {seat} ({name})!',
    wolves_win: 'The Werewolves win. The pack devours the town.',
    good_win: 'The Town wins. Every werewolf has been found.',
  },
  zh: {
    game_start: '本局开始，板子「{board}」，{count} 名玩家入座。',
    night_fall: '第 {day} 夜降临，天黑请闭眼。',
    wolves_wake: '狼人请睁眼，选择今晚的猎物。',
    seer_wake: '预言家请睁眼，你要查验谁？',
    witch_wake: '女巫请睁眼，是否使用解药或毒药？',
    day_break: '第 {day} 天，天亮了，全村醒来。',
    deaths: '昨晚倒下的是：{names}。',
    no_death: '平安夜，无人死亡。',
    speak_start: '进入发言阶段，轮流发言——只有当前发言者持麦。',
    speaker_turn: '请 {seat} 号（{name}）发言。',
    vote_start: '进入投票，选择放逐谁。',
    exiled: '全村放逐了 {seat} 号（{name}）。',
    no_exile: '投票平票，无人被放逐。',
    hunter_fires: '猎人开枪，带走了 {seat} 号（{name}）！',
    wolves_win: '狼人阵营胜利，狼群吞噬了村庄。',
    good_win: '好人阵营胜利，所有狼人已被找出。',
  },
  es: {
    game_start: 'Comienza la partida en el tablero "{board}". {count} jugadores se sientan.',
    night_fall: 'Cae la noche {day}. Todos, cierren los ojos.',
    wolves_wake: 'Hombres lobo, abran los ojos y elijan su presa.',
    seer_wake: 'Vidente, abre los ojos. ¿A quién quieres revisar?',
    witch_wake: 'Bruja, abre los ojos. ¿Salvar o envenenar?',
    day_break: 'Amanece el día {day}. El pueblo despierta.',
    deaths: 'Anoche perdimos a: {names}.',
    no_death: 'Noche en paz: nadie murió.',
    speak_start: 'Comienza la discusión. Hablen por turnos; solo el orador actual tiene el micrófono.',
    speaker_turn: 'El asiento {seat} ({name}) tiene la palabra.',
    vote_start: 'Hora de votar. Elijan a quién exiliar.',
    exiled: 'El pueblo exilia al asiento {seat} ({name}).',
    no_exile: 'Empate en la votación: nadie es exiliado.',
    hunter_fires: '¡El Cazador dispara y abate al asiento {seat} ({name})!',
    wolves_win: 'Ganan los Hombres Lobo. La manada devora al pueblo.',
    good_win: 'Gana el Pueblo. Todos los lobos fueron hallados.',
  },
  ar: {
    game_start: 'تبدأ اللعبة على لوحة "{board}". يجلس {count} لاعبين.',
    night_fall: 'يحل الليل {day}. ليغمض الجميع أعينهم.',
    wolves_wake: 'أيها المستذئبون، افتحوا أعينكم واختاروا فريستكم.',
    seer_wake: 'أيها العرّاف، افتح عينيك. من تريد أن تفحص؟',
    witch_wake: 'أيتها الساحرة، افتحي عينيك. هل تنقذين أم تسممين؟',
    day_break: 'يشرق نهار {day}. تستيقظ البلدة.',
    deaths: 'الليلة الماضية فقدنا: {names}.',
    no_death: 'ليلة هادئة — لم يمت أحد.',
    speak_start: 'يبدأ النقاش. تحدثوا بالدور — المتحدث الحالي فقط يملك الميكروفون.',
    speaker_turn: 'المقعد {seat} ({name}) له الكلمة.',
    vote_start: 'وقت التصويت. اختاروا من تنفونه.',
    exiled: 'تنفي البلدة المقعد {seat} ({name}).',
    no_exile: 'تعادل التصويت — لا أحد يُنفى.',
    hunter_fires: 'يطلق الصياد النار ويسقط المقعد {seat} ({name})!',
    wolves_win: 'فاز المستذئبون. التهم القطيع البلدة.',
    good_win: 'فازت البلدة. تم كشف كل المستذئبين.',
  },
};

export function host(lang: string, key: HostKey, params: Record<string, string | number> = {}): string {
  const table = HOST_I18N[lang] ?? HOST_I18N[FALLBACK];
  const tpl = table[key] ?? HOST_I18N[FALLBACK][key];
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''));
}

// 私密通知模板（女巫看到的被刀者、查验结果、个人死亡通知等）。
export type NoticeKey = 'seer_is_wolf' | 'seer_is_good' | 'witch_victim' | 'witch_victim_none' | 'you_died' | 'hunter_prompt' | 'wolf_pick_prompt' | 'seer_pick_prompt';
const NOTICE_I18N: Record<string, Record<NoticeKey, string>> = {
  en: {
    seer_is_wolf: 'Your vision is clear: Seat {seat} ({name}) is a WEREWOLF.',
    seer_is_good: 'Your vision is clear: Seat {seat} ({name}) is GOOD.',
    witch_victim: 'Tonight the wolves attacked Seat {seat} ({name}). Use your Antidote to save them, or pick someone to Poison.',
    witch_victim_none: 'The wolves attacked no one tonight. You may Poison someone, or do nothing.',
    you_died: 'You have died. You may keep watching, but no longer speak or vote.',
    hunter_prompt: 'You are the Hunter and you have fallen — choose one player to shoot.',
    wolf_pick_prompt: 'Choose a player to kill tonight.',
    seer_pick_prompt: 'Choose a player to check tonight.',
  },
  zh: {
    seer_is_wolf: '你的视野清晰：{seat} 号（{name}）是【狼人】。',
    seer_is_good: '你的视野清晰：{seat} 号（{name}）是【好人】。',
    witch_victim: '今晚狼人袭击了 {seat} 号（{name}）。可用解药救他，或选择一人下毒。',
    witch_victim_none: '今晚狼人没有袭击任何人。你可以毒一人，或什么都不做。',
    you_died: '你已死亡。可以继续观战，但不能再发言或投票。',
    hunter_prompt: '你是猎人且已倒下——选择开枪带走一名玩家。',
    wolf_pick_prompt: '选择今晚要刀掉的玩家。',
    seer_pick_prompt: '选择今晚要查验的玩家。',
  },
  es: {
    seer_is_wolf: 'Tu visión es clara: el asiento {seat} ({name}) es HOMBRE LOBO.',
    seer_is_good: 'Tu visión es clara: el asiento {seat} ({name}) es BUENO.',
    witch_victim: 'Esta noche los lobos atacaron al asiento {seat} ({name}). Usa tu Antídoto para salvarlo, o elige a quién Envenenar.',
    witch_victim_none: 'Los lobos no atacaron a nadie. Puedes Envenenar a alguien o no hacer nada.',
    you_died: 'Has muerto. Puedes seguir mirando, pero ya no hablas ni votas.',
    hunter_prompt: 'Eres el Cazador y has caído: elige a un jugador para disparar.',
    wolf_pick_prompt: 'Elige a un jugador para matar esta noche.',
    seer_pick_prompt: 'Elige a un jugador para revisar esta noche.',
  },
  ar: {
    seer_is_wolf: 'رؤيتك واضحة: المقعد {seat} ({name}) مستذئب.',
    seer_is_good: 'رؤيتك واضحة: المقعد {seat} ({name}) صالح.',
    witch_victim: 'الليلة هاجم الذئاب المقعد {seat} ({name}). استخدمي الترياق لإنقاذه أو اختاري من تسممين.',
    witch_victim_none: 'لم يهاجم الذئاب أحدًا الليلة. يمكنك تسميم أحد أو لا تفعلي شيئًا.',
    you_died: 'لقد متّ. يمكنك المشاهدة لكن لا يمكنك التحدث أو التصويت.',
    hunter_prompt: 'أنت الصياد وقد سقطت — اختر لاعبًا لإطلاق النار عليه.',
    wolf_pick_prompt: 'اختر لاعبًا لقتله الليلة.',
    seer_pick_prompt: 'اختر لاعبًا لفحصه الليلة.',
  },
};

export function notice(lang: string, key: NoticeKey, params: Record<string, string | number> = {}): string {
  const table = NOTICE_I18N[lang] ?? NOTICE_I18N[FALLBACK];
  const tpl = table[key] ?? NOTICE_I18N[FALLBACK][key];
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''));
}

// ---------- AI 玩家台词 ----------
// AI 玩家被分配一个母语，用该母语「发言」，再经 MT 翻成每个听者母语 → 演示跨语言。
// 台词按阵营/角色分池；{seat} 注入一个怀疑对象座位号。
export const AI_LINES: Record<string, { good: string[]; wolf: string[]; claimSeer?: string[] }> = {
  en: {
    good: ['I feel Seat {seat} is acting suspicious.', 'I am just a villager, trust me.', "Let's vote out Seat {seat} and see.", 'Nothing stood out last night, stay calm.'],
    wolf: ['I am definitely good, look elsewhere.', 'Seat {seat} talks too much, very wolfish.', "I'd vote Seat {seat}, bad vibes.", 'Calm down, no need to rush me.'],
    claimSeer: ['I am the Seer — Seat {seat} is a wolf.'],
  },
  zh: {
    good: ['我感觉 {seat} 号有点可疑。', '我就是个平民，相信我。', '先把 {seat} 号票出去看看。', '昨晚没什么异常，大家稳住。'],
    wolf: ['我肯定是好人，别看我。', '{seat} 号话太多了，很像狼。', '我投 {seat} 号，感觉不对。', '别急着冲我，冷静点。'],
    claimSeer: ['我是预言家——{seat} 号是狼。'],
  },
  es: {
    good: ['Siento que el asiento {seat} actúa sospechoso.', 'Solo soy un aldeano, confíen en mí.', 'Votemos al asiento {seat} y veamos.', 'Nada raro anoche, mantengan la calma.'],
    wolf: ['Soy bueno, miren a otro lado.', 'El asiento {seat} habla demasiado, muy lobo.', 'Yo votaría al asiento {seat}.', 'Calma, no me apuren.'],
    claimSeer: ['Soy la Vidente: el asiento {seat} es lobo.'],
  },
  ar: {
    good: ['أشعر أن المقعد {seat} يتصرف بريبة.', 'أنا مجرد قروي، ثقوا بي.', 'لنصوّت ضد المقعد {seat} ونرى.', 'لا شيء غريب الليلة، اهدؤوا.'],
    wolf: ['أنا صالح بالتأكيد، انظروا لغيري.', 'المقعد {seat} يتكلم كثيرًا، يبدو ذئبًا.', 'سأصوّت ضد المقعد {seat}.', 'تمهلوا، لا داعي للعجلة معي.'],
    claimSeer: ['أنا العرّاف — المقعد {seat} ذئب.'],
  },
};

export function aiLine(lang: string, camp: WolfCamp, suspectSeat: number): string {
  const pool = AI_LINES[lang] ?? AI_LINES[FALLBACK];
  const arr = camp === 'WOLF' ? pool.wolf : pool.good;
  const tpl = arr[Math.floor(Math.random() * arr.length)] ?? arr[0];
  return tpl.replace('{seat}', String(suspectSeat));
}
