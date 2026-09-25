import { L, type Localized, type PartyId } from "../types/scorecard.js";

/**
 * Readings that sit beside the official Hebrew ballot name.
 * Hebrew is filled from partyNameHe / leaderHe so the ballot string stays the source.
 * Other locales are unreviewed implementation drafts (see docs/TRANSLATION-REVIEW.md).
 * Personal names are transliterations. List names use the usual exonym, or a short
 * translation when the Hebrew name is a phrase.
 */

type Reading = { ar: string; yi: string; ru: string; uk: string; en: string; am: string };

function reading(ar: string, yi: string, ru: string, uk: string, en: string, am: string): Reading {
  return { ar, yi, ru, uk, en, am };
}

export function localizedName(he: string, gloss: Reading): Localized {
  return L({ he, ...gloss });
}

export const entityReadings: Record<PartyId, { party: Reading; leader: Reading }> = {
  likud: {
    party: reading("الليكود", "ליכוד", "Ликуд", "Лікуд", "Likud", "ሊኩድ"),
    leader: reading("بنيامين نتنياهو", "בנימין נתניהו", "Биньямин Нетаньяху", "Беньямін Нетаньягу", "Benjamin Netanyahu", "ቢንያሚን ኔታንያሁ")
  },
  beyachad: {
    party: reading("بييحد (معًا)", "צוזאַמען", "Бейахад («Вместе»)", "Беяхад («Разом»)", "Beyachad (Together)", "በያሐድ (አንድ ላይ)"),
    leader: reading("نفتالي بينيت", "נפתלי בנט", "Нафтали Беннет", "Нафталі Беннет", "Naftali Bennett", "ናፍታሊ ቤኔት")
  },
  yashar: {
    party: reading("يشار!", "ישר!", "Яшар!", "Яшар!", "Yashar!", "ያሻር!"),
    leader: reading("غادي آيزنكوت", "גדי איזנקוט", "Гади Айзенкот", "Ґаді Айзенкот", "Gadi Eisenkot", "ጋዲ ኢዘንኮት")
  },
  "blue-white": {
    party: reading("أزرق أبيض", "בלוי און ווײַס", "Кахоль-лаван («Сине-белые»)", "Кахоль-лаван («Синьо-білі»)", "Blue and White", "ካሆል ላቫን (ሰማያዊ እና ነጭ)"),
    leader: reading("بيني غانتس", "בני גנץ", "Бени Ганц", "Бені Ґанц", "Benny Gantz", "ቤኒ ጋንትስ")
  },
  "the-democrats": {
    party: reading("الديمقراطيون", "די דעמאָקראַטן", "Демократы", "Демократи", "The Democrats", "ዴሞክራቶች"),
    leader: reading("يائير غولان", "יאיר גולן", "Яир Голан", "Яїр Ґолан", "Yair Golan", "ያኢር ጎላን")
  },
  "yisrael-beiteinu": {
    party: reading("إسرائيل بيتنو", "ישראל ביתנו", "Наш дом Израиль", "Наш дім Ізраїль", "Yisrael Beiteinu", "እስራኤል ቤይቴኑ"),
    leader: reading("أفيغدور ليبرمان", "אביגדור ליברמן", "Авигдор Либерман", "Авіґдор Ліберман", "Avigdor Lieberman", "አቪግዶር ሊበርማን")
  },
  shas: {
    party: reading("شاس", "ש\"ס", "ШАС", "ШАС", "Shas", "ሻስ"),
    leader: reading("أرييه درعي", "אריה דרעי", "Арье Дери", "Ар'є Дері", "Aryeh Deri", "አርዬ ዴሪ")
  },
  utj: {
    party: reading("يهدوت هتوراه", "תורה־ייִדנטום", "Яхадут ха-Тора", "Ягадут га-Тора", "United Torah Judaism", "ያሃዱት ሃቶራ"),
    leader: reading("يعقوب آشر", "יעקב אשר", "Яаков Ашер", "Яаков Ашер", "Yaakov Asher", "ያአኮቭ አሸር")
  },
  "religious-zionism": {
    party: reading("الصهيونية الدينية وهَزْهُوت", "רעליגיעזער ציוניזם און זהות", "Религиозный сионизм и Зехут", "Релігійний сіонізм і Зехут", "Religious Zionism and Zehut", "ሃትዚዮኑት ሃዳቲት እና ዜሁት"),
    leader: reading("بتسلئيل سموتريتش", "בצלאל סמוטריץ'", "Бецалель Смотрич", "Бецалель Смотріч", "Bezalel Smotrich", "ቤዛለል ስሞትሪች")
  },
  "otzma-yehudit": {
    party: reading("عوتسما يهوديت", "ייִדישע מאַכט", "Оцма Йехудит", "Оцма Єгудіт", "Otzma Yehudit", "ኦትዝማ የሁዲት"),
    leader: reading("إيتمار بن غفير", "איתמר בן גביר", "Итамар Бен-Гвир", "Ітамар Бен-Ґвір", "Itamar Ben-Gvir", "ኢታማር ቤን-ጔቪር")
  },
  noam: {
    party: reading("نُوعَم لإسرائيل", "נעם פֿאַר ישׂראל", "Ноам ле-Исраэль", "Ноам ле-Ісраель", "Noam for Israel", "ኖዓም ለእስራኤል"),
    leader: reading("آفي ماعوز", "אבי מעוז", "Ави Маоз", "Аві Маоз", "Avi Maoz", "አቪ ማኦዝ")
  },
  raam: {
    party: reading("رع\"م — القائمة العربية الموحدة", "רע\"ם", "РААМ", "РААМ", "Ra'am (United Arab List)", "ራዓም"),
    leader: reading("منصور عباس", "מנסור עבאס", "Мансур Аббас", "Мансур Аббас", "Mansour Abbas", "መንሱር አባስ")
  },
  "joint-list": {
    party: reading("القائمة المشتركة", "די געמיינזאַמע רשימה", "Общий список", "Спільний список", "The Joint List", "የጋራ ዝርዝር"),
    leader: reading("يوسف جبارين", "יוסף ג'בארין", "Юсеф Джабарин", "Юсеф Джабарін", "Yousef Jabareen", "ዩሴፍ ጃባሪን")
  },
  "reservists-economy": {
    party: reading("الاحتياطيون والاقتصاد", "די מילואים־לײַט און די עקאָנאָמישע", "Резервисты и экономическая", "Резервісти й економічна", "The Reservists and the Economic list", "የምልዓተ-ጦር እና የኢኮኖሚ ዝርዝር"),
    leader: reading("يوعاز هندل", "יועז הנדל", "Йоаз Хендель", "Йоаз Гендель", "Yoaz Hendel", "ዮአዝ ሄንዴል")
  },
  "amcha-yisrael": {
    party: reading("عمخا إسرائيل", "דײַן פֿאָלק ישׂראל", "Амха Исраэль", "Амха Ісраель", "Amcha Yisrael", "አምካ እስራኤል"),
    leader: reading("عوفر وينتر", "עופר וינטר", "Офер Винтер", "Офер Вінтер", "Ofer Winter", "ኦፈር ዊንተር")
  },
  "israel-first": {
    party: reading("إسرائيل أولًا", "ישׂראל צוערשט", "Израиль прежде всего", "Ізраїль насамперед", "Israel First", "እስራኤል መጀመሪያ"),
    leader: reading("شاران هسكيل", "שרן השכל", "Шаран Аскель", "Шаран Гаскель", "Sharren Haskel", "ሻረን ሀስኬል")
  },
  pirates: {
    party: reading("القراصنة", "די פּיראַטן", "Пираты", "Пірати", "The Pirates", "ፓይሬቶች"),
    leader: reading("أوهاد شيم طوف", "אוהד שם טוב", "Охад Шем Тов", "Огад Шем Тов", "Ohad Shem Tov", "ኦሃድ ሼም ቶቭ")
  },
  sharshar: {
    party: reading("شرشر (سلسلة)", "קײַט", "Шаршар («Цепь»)", "Шаршар («Ланцюг»)", "Sharshar (Chain)", "ሻርሻር (ሰንሰለት)"),
    leader: reading("إيتان شفيلي", "איתן שווילי", "Эйтан Швили", "Ейтан Швілі", "Eitan Shvili", "ኤይታን ሽቪሊ")
  },
  "partnership-for-all": {
    party: reading("الشراكة للجميع", "די שותּפֿות פֿאַר אַלעמען", "Партнёрство для всех", "Партнерство для всіх", "The Partnership for Everyone", "ሽርክና ለሁሉም"),
    leader: reading("طلال القريناوي", "טלאל אלקרינאוי", "Талаль аль-Кренави", "Талаль аль-Кренаві", "Talal Al-Krenawi", "ጠላል አል-ክረናዊ")
  },
  "together-succeed": {
    party: reading("معًا سننجح", "צוזאַמען וועלן מיר מצליח זײַן", "Вместе преуспеем", "Разом досягнемо", "Together We Will Succeed", "አንድ ላይ እንሳካለን"),
    leader: reading("آفي شاكيد", "אבי שקד", "Ави Шакед", "Аві Шакед", "Avi Shaked", "አቪ ሻኬድ")
  },
  "womens-voice": {
    party: reading("صوت النساء", "דער קול פֿון פֿרויען", "Голос женщин", "Голос жінок", "Women's Voice", "የሴቶች ድምጽ"),
    leader: reading("عمير شدمي", "עמיר שדמי", "Амир Шадми", "Амір Шадмі", "Amir Shadmi", "አሚር ሻድሚ")
  },
  "gan-eden": {
    party: reading("جن عدن (الفردوس)", "גן־עדן", "Ган Эден («Рай»)", "Ґан Еден («Рай»)", "Gan Eden (Paradise)", "ገነት"),
    leader: reading("يشوع بن داود", "ישועה בן דוד", "Ешуа Бен Давид", "Єшуа Бен Давид", "Yeshua Ben David", "የሹዓ ቤን ዳቪድ")
  },
  "justice-law": {
    party: reading("قضاء العدل", "יושר־משפּט", "Мишпат цедек («Правосудие»)", "Мішпат цедек («Правосуддя»)", "Mishpat Tzedek (Justice)", "ሚሽፓት ጼዴክ (ፍትሕ)"),
    leader: reading("لاريسا عمير", "לריסה עמיר", "Лариса Амир", "Ларіса Амір", "Larisa Amir", "ላሪሳ አሚር")
  },
  shema: {
    party: reading("شماع", "שמע", "Шма", "Шма", "Shema", "ሽማ"),
    leader: reading("نفتالي غولدمان", "נפתלי גולדמן", "Нафтали Гольдман", "Нафталі Ґольдман", "Naftali Goldman", "ናፍታሊ ጎልድማን")
  },
  "new-order": {
    party: reading("نظام جديد", "אַ נײַע אָרדענונג", "Сэдер хадаш («Новый порядок»)", "Седер хадаш («Новий порядок»)", "Seder Hadash (New Order)", "ሴደር ሐዳሽ (አዲስ ሥርዓት)"),
    leader: reading("أفيتال أوفيك", "אביטל אופק", "Авиталь Офек", "Авіталь Офек", "Avital Ofek", "አቪታል ኦፌክ")
  },
  "haredi-public": {
    party: reading("الجمهور الحريدي", "דאָס חרדישע עולם", "Харедей цибур («Харедейская публика»)", "Харедей цибур («Харедейська публіка»)", "The Haredi Public", "የሐረዲ ሕዝብ"),
    leader: reading("موتي لايتنر", "מוטי ליטנר", "Моти Лейтнер", "Моті Лейтнер", "Moti Leitner", "ሞቲ ሌይትነር")
  },
  "ani-veata": {
    party: reading("أنا وأنت", "איך און דו", "Ани ве-ата («Я и ты»)", "Ані ве-ата («Я і ти»)", "Ani Ve'ata (Me and You)", "አኒ ቬአታ (እኔና አንተ)"),
    leader: reading("ألون غلعادي", "אלון גלעדי", "Алон Гилади", "Алон Ґіладі", "Alon Giladi", "አሎን ጊላዲ")
  },
  "brit-olam": {
    party: reading("عهد العالم", "אַן אייביקער בונד", "Брит олам («Вечный союз»)", "Бріт олам («Вічний союз»)", "Brit Olam (Eternal Covenant)", "ብሪት ኦላም (ዘላለማዊ ቃል ኪዳን)"),
    leader: reading("عوفر ليفشيتس", "עופר ליפשיץ", "Офер Лифшиц", "Офер Ліфшиц", "Ofer Lipshitz", "ኦፈር ሊፕሺትስ")
  },
  "electoral-reform": {
    party: reading("إصلاح نظام الانتخابات والحكم", "די פֿאַרריכטונג פֿון וואַלן און רעגירונג", "Исправление избирательной системы и власти", "Виправлення виборчої системи і влади", "Electoral and Government Reform", "የምርጫ እና የመንግሥት ማሻሻያ"),
    leader: reading("موشيه سلوموفيتش", "משה סלומוביץ", "Моше Саломович", "Моше Саломович", "Moshe Salomovich", "ሞሼ ሳሎሞቪች")
  },
  "biblical-bloc": {
    party: reading("الكتلة التوراتية", "דער תּנ״כישער בלאָק", "Библейский блок", "Біблійний блок", "The Biblical Bloc", "መጽሐፍ ቅዱሳዊ ቡድን"),
    leader: reading("موشيه ليبكين", "משה ליפקין", "Моше Липкин", "Моше Ліпкін", "Moshe Lipkin", "ሞሼ ሊፕኪን")
  },
  "social-security": {
    party: reading("بِطَح (ضمان اجتماعي)", "סאָציאַלע זיכערקייט", "Бетах («Соцобеспечение»)", "Бетах («Соцзабезпечення»)", "Betach (Social Security)", "ቤታሕ (ማህበራዊ ዋስትና)"),
    leader: reading("سيميون غرافمان", "סמיון גרפמן", "Семен Графман", "Семен Ґрафман", "Semyon Grafman", "ሰሚዮን ግራፍማን")
  },
  "orot-hashachar": {
    party: reading("أوروت هشاحر (أنوار الفجر)", "ליכט פֿון פֿאַרטאָג", "Орот ха-шахар («Огни зари»)", "Орот га-шахар («Вогні світанку»)", "Orot HaShachar (Lights of Dawn)", "ኦሮት ሃሻሐር (የንጋት ብርሃን)"),
    leader: reading("نيسيم لوك", "נסים לוק", "Нисим Лук", "Нісім Лук", "Nissim Luk", "ኒሲም ሉክ")
  },
  "personal-security": {
    party: reading("الأمن الشخصي", "פּערזענלעכע זיכערקייט", "Личная безопасность", "Особиста безпека", "Personal Security", "የግል ደህንነት"),
    leader: reading("ميخائيل توبتشيآشفيلي", "מיכאל טופצ'יאשווילי", "Михаил Топчиашвили", "Міхаель Топчіашвілі", "Michael Topchiashvili", "ሚካኤል ቶፕቺያሽቪሊ")
  },
  "black-banner": {
    party: reading("اللون الأسود", "שװאַרצע פֿאָן", "Цева шахор («Чёрный цвет»)", "Цева шахор («Чорний колір»)", "Tzeva Shachor (Black)", "ጼቫ ሻሖር (ጥቁር)"),
    leader: reading("إلياهو بويمرند", "אליהו בוימרינד", "Элияху Боймринд", "Еліягу Боймрінд", "Eliyahu Boimrind", "ኤሊያሁ ቦይምሪንድ")
  },
  ahi: {
    party: reading("حركة أحي", "באַוועגונג אח\"י", "Движение Ахи", "Рух Ахі", "Ahi Movement", "የአሒ ንቅናቄ"),
    leader: reading("يوفال إليميليخ", "יובל אלימלך", "Юваль Элимелех", "Юваль Елімелех", "Yuval Elimelech", "ዩቫል ኤሊሜሌክ")
  },
  "tzomet-beit-yisrael": {
    party: reading("تسومِت — بيت إسرائيل", "צומת — בית ישׂראל", "Цомет — Бейт Исраэль", "Цомет — Бейт Ісраель", "Tzomet – Beit Yisrael", "ጾመት – ቤት እስራኤል"),
    leader: reading("ديستا يفركان", "דסטה יברקן", "Деста Еваркан", "Деста Єваркан", "Desta Yevarkan", "ደስታ የቫርካን")
  },
  tkuma: {
    party: reading("تكوما (نهضة)", "אויפֿלעבונג", "Ткума («Возрождение»)", "Ткума («Відродження»)", "Tkuma (Revival)", "ትኩማ (መነቃቃት)"),
    leader: reading("إلكانا فيدرمان", "אלקנה פדרמן", "Элькана Федерман", "Елькана Федерман", "Elkana Federman", "ኤልካና ፌደርማን")
  },
  hakahal: {
    party: reading("هَكاهَل (الجمهور)", "דער קהל", "Ха-кагаль («Собрание»)", "Га-кагаль («Зібрання»)", "HaKahal (The Assembly)", "ሃካሃል (ጉባኤ)"),
    leader: reading("شلومو ألبويم", "שלמה אלבוים", "Шломо Альбоим", "Шломо Альбоім", "Shlomo Alboim", "ሽሎሞ አልቦይም")
  }
};
