import { L } from "../types/scorecard.js";
import { assertPositionsDataset, type PositionSource, type PositionsDataset, type PositionSpeaker } from "../types/positions.js";

/**
 * Public statements on the ten standard questions, as of 24 October 2026, three days before the
 * 26th Knesset election. Every entry was read at its source; summaries are paraphrases, not quotes.
 * A stance compares the statement with the standard's commitment as written; it is not a score.
 *
 * Coverage: statements were collected for the 15 tracked lists. The other 22 approved lists were not reviewed.
 * Non-Hebrew text is machine-translated and pending human review (docs/TRANSLATION-REVIEW.md).
 */

const published = (outlet: string, url: string, date: string): PositionSource => ({ outlet, url, date, dateKind: "published" });
const accessed = (outlet: string, url: string): PositionSource => ({ outlet, url, date: "2026-10-24", dateKind: "accessed" });

const src = {
  ynetInquiry: published("Ynet", "https://www.ynet.co.il/news/elections2026/article/yokra14915209", "2026-10-04"),
  ynetJudiciary: published("Ynet", "https://www.ynet.co.il/news/elections2026/article/yokra14903844", "2026-09-22"),
  ynet100Days: published("Ynet", "https://www.ynet.co.il/news/elections2026/article/yokra14935642", "2026-10-23"),
  ynetPolice: accessed("Ynet", "https://www.ynet.co.il/news/elections2026/article/ryeoxysuge"),
  ynetSecondAuthority: accessed("Ynet", "https://www.ynet.co.il/news/article/bjm00i2w7fx"),
  ynetBenGvir: accessed("Ynet", "https://www.ynet.co.il/news/elections2026/article/bj7vpgx5gx"),
  idiSecondAuthority: published("Israel Democracy Institute", "https://www.idi.org.il/articles/64978", "2026-07-08"),
  makoJudiciary: published("N12", "https://www.mako.co.il/news-israel-elections/2026/Article-1b5d451818a21a1026.htm", "2026-10-11"),
  makoBennett: published("N12", "https://www.mako.co.il/news-israel-elections/2026/Article-36775f2c58dcd91027.htm", "2026-04-27"),
  makoNetanyahu: published("N12", "https://www.mako.co.il/news-israel-elections/2026/Article-d33e271b1f751a1026.htm", "2026-10-20"),
  makoJointList: published("N12", "https://www.mako.co.il/news-politics/2026_q4/Article-bf2378e5bd621a1026.htm", "2026-10-10"),
  makoBudgets: published("N12", "https://www.mako.co.il/finances-magazine/Article-12fb0f1362451a1026.htm", "2026-10-22"),
  iceBoycotts: published("ice", "https://www.ice.co.il/research/news/article/1134027", "2026-10-18"),
  jpostKisch: published("The Jerusalem Post", "https://www.jpost.com/israel-election-2026/article-912101", "2026-10-19"),
  kikarAsher: published("Kikar HaShabbat", "https://www.kikar.co.il/haredim-news/tmr8u6", "2026-10-11"),
  emessDeri: published("Emess", "https://www.emess.co.il/radio/1948643", "2026-10-21"),
  toiUnrest: published("The Times of Israel", "https://www.timesofisrael.com/israel-is-primed-for-clashes-around-election-day-is-there-a-way-out/", "2026-10-23"),
  toiDissolution: published("The Times of Israel", "https://www.timesofisrael.com/mks-advance-bill-to-dissolve-knesset-and-potentially-move-up-elections-to-september/", "2026-06-02"),
  koreJointPledge: published("Kol Rega", "https://www.kore.co.il/viewArticle/220646", "2026-09-08"),
  france24Abbas: published("France 24", "https://www.france24.com/ar/%D8%A7%D9%84%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1%D8%A7%D9%84%D9%85%D8%B3%D8%AA%D9%85%D8%B1%D8%A9/20261021-%D8%B1%D8%A6%D9%8A%D8%B3-%D8%A7%D9%84%D9%82%D8%A7%D8%A6%D9%85%D8%A9-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9-%D8%A7%D9%84%D9%85%D9%88%D8%AD%D8%AF%D8%A9-%D9%85%D9%86%D8%B5%D9%88%D8%B1-%D8%B9%D8%A8%D8%A7%D8%B3-%D9%81%D9%88%D8%B2-%D9%86%D8%AA%D8%A7%D9%86%D9%8A%D8%A7%D9%87%D9%88-%D9%81%D9%8A-%D8%A7%D9%84%D8%A7%D9%86%D8%AA%D8%AE%D8%A7%D8%A8%D8%A7%D8%AA-%D8%B3%D9%8A%D9%83%D9%88%D9%86-%D9%83%D8%A7%D8%B1%D8%AB%D8%A9-%D9%85%D9%82%D8%A7%D8%A8%D9%84%D8%A9", "2026-10-21"),
  zmanHendel: published("Zman Israel", "https://www.zman.co.il/live/734907/", "2026-10-20"),
  markerHendel: published("TheMarker", "https://www.themarker.com/news/elections/2026-10-19/ty-article/000001a1-529c-da52-a3f1-5ede3c260000", "2026-10-19"),
  beytenuPlatform: accessed("Yisrael Beiteinu", "https://beytenu.org.il/party-platform/"),
  beyahadPlans: accessed("Beyachad", "https://be-yahad.org.il/plans/?bennett_plans_cat=198"),
  democratsSite: accessed("The Democrats", "https://yes.democrats.org.il/"),
  israelFirstPlan: accessed("Israel First", "https://israelfirst.co.il/work-plan/"),
  ynetElectionDate: accessed("Ynet", "https://www.ynet.co.il/news/article/bj4s2gwnfx"),
  haaretzZini: published("Haaretz", "https://www.haaretz.co.il/news/elections/2026-07-12/ty-article/.highlight/0000019f-52b3-de66-a5bf-53f3aa070000", "2026-07-12"),
  kikarNoam: published("Kikar HaShabbat", "https://www.kikar.co.il/israel-news/tjpzrq", "2026-08-13"),
  makoGolan100: accessed("N12", "https://www.mako.co.il/news-israel-elections/2026/Article-53c6ffa50321f91027.htm")
};

const kisch: PositionSpeaker = {
  he: "יואב קיש",
  reading: L({ he: "יואב קיש", ar: "يوآف كيش", yi: "יואב קיש", ru: "Йоав Киш", uk: "Йоав Кіш", en: "Yoav Kisch", am: "ዮአቭ ኪሽ" }),
  role: L({ he: "שר החינוך", ar: "وزير التعليم", yi: "בילדונגס־מיניסטער", ru: "министр образования", uk: "міністр освіти", en: "Education Minister", am: "የትምህርት ሚኒስትር" })
};
const feiglin: PositionSpeaker = {
  he: "משה פייגלין",
  reading: L({ he: "משה פייגלין", ar: "موشيه فيغلين", yi: "משה פייגלין", ru: "Моше Фейглин", uk: "Моше Фейґлін", en: "Moshe Feiglin", am: "ሞሼ ፋይግሊን" }),
  role: L({ he: "יו\"ר זהות", ar: "رئيس زهوت", yi: "פֿאָרזיצער פֿון זהות", ru: "лидер «Зеут»", uk: "лідер «Зеут»", en: "Zehut leader", am: "የዜሁት መሪ" })
};
const lapid: PositionSpeaker = {
  he: "יאיר לפיד",
  reading: L({ he: "יאיר לפיד", ar: "يائير لبيد", yi: "יאיר לפיד", ru: "Яир Лапид", uk: "Яїр Лапід", en: "Yair Lapid", am: "ያኢር ላፒድ" }),
  role: L({ he: "מספר 2 ברשימה", ar: "الثاني في القائمة", yi: "נומער 2 אויף דער רשימה", ru: "№ 2 в списке", uk: "№ 2 у списку", en: "No. 2 on the list", am: "በዝርዝሩ ቁጥር 2" })
};

const declinedInquiry = L({
  he: "סירבה להשיב לשאלת ynet כיצד יש לחקור את 7 באוקטובר.",
  ar: "رفضت الرد على سؤال Ynet حول كيفية التحقيق في 7 أكتوبر.",
  yi: "האָט זיך אָפּגעזאָגט צו ענטפֿערן אויף Ynets פֿראַגע ווי אַזוי מע זאָל אויספֿאָרשן דעם 7טן אָקטאָבער.",
  ru: "Отказалась ответить на вопрос Ynet о том, как расследовать 7 октября.",
  uk: "Відмовилася відповісти на запитання Ynet про те, як розслідувати 7 жовтня.",
  en: "Declined to answer Ynet's question on how 7 October should be investigated.",
  am: "ጥቅምት 7 እንዴት መመርመር እንዳለበት ለYnet ጥያቄ መልስ ለመስጠት ፈቃደኛ አልሆነም።"
});

export const positions2026: PositionsDataset = {
  asOf: "2026-10-24",
  tracked: [
    "yashar",
    "beyachad",
    "likud",
    "yisrael-beiteinu",
    "the-democrats",
    "shas",
    "utj",
    "religious-zionism",
    "otzma-yehudit",
    "amcha-yisrael",
    "raam",
    "joint-list",
    "reservists-economy",
    "israel-first",
    "noam"
  ],

  context: [
    {
      id: "ctx-election-date",
      question: "elections-on-time",
      summary: L({
        he: "לא מצאנו הצעת חוק להארכת כהונת הכנסת ה-25. ועדת הכנסת קבעה את פיזור הכנסת ל-17.7.2026, והבחירות מתקיימות במועדן המקורי, 27.10.2026 — לראשונה מאז 1988. הצעת חוק הפיזור עברה בקריאה ראשונה ב-106–0 (2.6.2026).",
        ar: "لم نجد أي مشروع قانون لتمديد ولاية الكنيست الـ25. حدّدت لجنة الكنيست حلّه في 17.7.2026، وتُجرى الانتخابات في موعدها الأصلي، 27.10.2026 — لأول مرة منذ 1988. وأُقرّ مشروع قانون الحل بالقراءة الأولى 106–0 (2.6.2026).",
        yi: "מיר האָבן ניט געפֿונען קיין געזעץ־פֿאָרשלאָג צו פֿאַרלענגערן די קאַדענץ פֿון דער 25סטער כנסת. די כנסת־קאָמיסיע האָט באַשטימט די צעלאָזונג אויפֿן 17.7.2026, און די וואַלן פֿאַלן אויף זייער אָריגינעלן דאַטום, 27.10.2026 — צום ערשטן מאָל זינט 1988. דער צעלאָזונג־פֿאָרשלאָג איז דורכגעגאַנגען ערשטע לייענונג 106–0 (2.6.2026).",
        ru: "Мы не нашли законопроекта о продлении полномочий Кнессета 25-го созыва. Комиссия Кнессета назначила роспуск на 17.7.2026, а выборы проходят в изначальный срок — 27.10.2026, впервые с 1988 года. Законопроект о роспуске прошёл первое чтение 106–0 (2.6.2026).",
        uk: "Ми не знайшли законопроєкту про продовження повноважень Кнесету 25-го скликання. Комісія Кнесету призначила розпуск на 17.7.2026, а вибори відбуваються в первісний строк — 27.10.2026, уперше з 1988 року. Законопроєкт про розпуск пройшов перше читання 106–0 (2.6.2026).",
        en: "We found no bill to extend the 25th Knesset's term. The Knesset Committee set dissolution for 17.7.2026, and the election is held on its original date, 27.10.2026, for the first time since 1988. The dissolution bill passed first reading 106–0 (2.6.2026).",
        am: "የ25ኛውን ክኔሴት የሥልጣን ዘመን የሚያራዝም ረቂቅ ሕግ አላገኘንም። የክኔሴቱ ኮሚቴ መበተኑን ለ17.7.2026 ወስኗል፤ ምርጫውም ከ1988 ወዲህ ለመጀመሪያ ጊዜ በመጀመሪያ ቀኑ 27.10.2026 ይካሄዳል። የመበተኛ ረቂቁ የመጀመሪያ ንባብን በ106–0 አልፏል (2.6.2026)።"
      }),
      sources: [src.ynetElectionDate, src.toiDissolution]
    },
    {
      id: "ctx-results",
      question: "election-results",
      summary: L({
        he: "לא מצאנו התחייבות פומבית של ראש רשימה כלשהו לקבל את התוצאות הרשמיות או להעברת שלטון בדרכי שלום. הליכוד והציונות הדתית הודיעו על הצבת כ-2,000 פעילים בקלפיות ביישובים ערביים בשל טענות להונאה. ב-22.10 קרא הנשיא הרצוג למועמדים להיזהר בדבריהם.",
        ar: "لم نجد أي التزام علني من رئيس أي قائمة بقبول النتائج الرسمية أو بنقل سلمي للسلطة. أعلن الليكود والصهيونية الدينية عن نشر نحو 2,000 ناشط في مراكز الاقتراع في البلدات العربية بسبب ادعاءات تزوير. في 22.10 دعا الرئيس هرتسوغ المرشحين إلى الحذر في كلامهم.",
        yi: "מיר האָבן ניט געפֿונען קיין עפֿנטלעכע התחייבות פֿון אַ רשימה־פֿירער אָנצונעמען די אָפֿיציעלע רעזולטאַטן אָדער אַ פֿרידלעכע איבערגאַב פֿון מאַכט. דער ליכוד און די ציונות הדתית האָבן געמאָלדן וועגן אַרום 2,000 אַקטיוויסטן בײַ די קלפּיות אין אַראַבישע ישובים צוליב טענות פֿון שווינדל. דעם 22.10 האָט פּרעזידענט הרצוג גערופֿן די קאַנדידאַטן צו רעדן מיט זהירות.",
        ru: "Мы не нашли публичного обязательства ни одного лидера списка признать официальные результаты или мирно передать власть. «Ликуд» и «Религиозный сионизм» объявили о размещении около 2000 активистов на участках в арабских населённых пунктах из-за заявлений о фальсификациях. 22.10 президент Герцог призвал кандидатов выбирать слова.",
        uk: "Ми не знайшли публічного зобов’язання жодного лідера списку визнати офіційні результати чи мирно передати владу. «Лікуд» і «Релігійний сіонізм» оголосили про розміщення близько 2000 активістів на дільницях в арабських населених пунктах через заяви про фальсифікації. 22.10 президент Герцоґ закликав кандидатів зважувати слова.",
        en: "We found no public commitment by any list leader to accept the official results or to a peaceful handover. Likud and Religious Zionism announced about 2,000 activists to watch polling stations in Arab towns over alleged fraud. On 22.10 President Herzog urged candidates to speak with care.",
        am: "የትኛውም ዝርዝር መሪ ኦፊሴላዊ ውጤቶችን ለመቀበል ወይም ሥልጣንን በሰላም ለማስረከብ የገባውን ይፋዊ ቃል አላገኘንም። ሊኩድ እና ሃይማኖታዊ ጽዮናዊነት በማጭበርበር ክስ ምክንያት በዐረብ ከተሞች የምርጫ ጣቢያዎች ወደ 2,000 የሚጠጉ አክቲቪስቶችን እንደሚያሰማሩ አስታወቁ። ፕሬዚዳንት ሄርዞግ በ22.10 ዕጩዎች በንግግራቸው እንዲጠነቀቁ ጠይቀዋል።"
      }),
      sources: [src.toiUnrest]
    },
    {
      id: "ctx-second-authority",
      question: "court-rulings",
      summary: L({
        he: "ב-5.7.2026 החליטה הממשלה פה אחד שלא להכיר בצו ביניים של בג\"ץ בעניין מועצת הרשות השנייה ובכל פעולה שתיעשה מכוחו. ההצעה הוגשה בידי השרים יריב לוין ושלמה קרעי; המשנה ליועמ\"ש אמר שהתקבלה בניגוד לייעוץ המשפטי.",
        ar: "في 5.7.2026 قررت الحكومة بالإجماع عدم الاعتراف بأمر مؤقت أصدرته المحكمة العليا بشأن مجلس السلطة الثانية، ولا بأي إجراء يُتخذ بموجبه. قدّم الاقتراح الوزيران ياريف ليفين وشلومو كرعي، وقال نائب المستشار القضائي إنه أُقرّ خلافًا للمشورة القانونية.",
        yi: "דעם 5.7.2026 האָט די רעגירונג איינשטימיק באַשלאָסן ניט צו אָנערקענען אַ צו ביניים פֿון בג\"ץ וועגן דער מועצה פֿון דער רשות השנייה, אָדער סיי וועלכע פּעולה אויפֿן סמך דערפֿון. דעם פֿאָרשלאָג האָבן געבראַכט די מיניסטאָרן יריב לוין און שלמה קרעי; דער משנה ליועמ\"ש האָט געזאָגט אַז ער איז אָנגענומען געוואָרן קעגן דער משפּטישער עצה.",
        ru: "5.7.2026 правительство единогласно решило не признавать временный приказ БАГАЦа о совете Второго управления теле- и радиовещания и любые действия на его основании. Предложение внесли министры Ярив Левин и Шломо Караи; заместитель юрсоветника заявил, что оно принято вопреки юридической консультации.",
        uk: "5.7.2026 уряд одностайно вирішив не визнавати тимчасовий наказ Багацу щодо ради Другого управління теле- і радіомовлення та будь-які дії на його підставі. Пропозицію внесли міністри Ярів Левін і Шломо Караї; заступник юрдорадника заявив, що її ухвалено всупереч юридичній пораді.",
        en: "On 5.7.2026 the government unanimously decided not to recognise a High Court interim order on the Second Authority council, or any action taken under it. Ministers Yariv Levin and Shlomo Karhi proposed it; the deputy attorney general said it was adopted against legal advice.",
        am: "በ5.7.2026 መንግሥት የሁለተኛው ባለሥልጣን ምክር ቤትን በተመለከተ ከፍተኛው ፍርድ ቤት የሰጠውን ጊዜያዊ ትእዛዝም ሆነ በእሱ መሠረት የሚወሰድ ማንኛውንም እርምጃ እንዳይቀበል በሙሉ ድምፅ ወሰነ። ሀሳቡን ያቀረቡት ሚኒስትሮች ያሪቭ ሌቪን እና ሽሎሞ ካርሂ ናቸው፤ ምክትል ጠቅላይ ዐቃቤ ሕጉ ውሳኔው ከሕግ ምክር በተቃራኒ መወሰዱን ተናግረዋል።"
      }),
      sources: [src.ynetSecondAuthority, src.idiSecondAuthority]
    },
    {
      id: "ctx-joint-inquiry-pledge",
      question: "october-7-inquiry",
      summary: L({
        he: "ב-8.9.2026 פרסמו איזנקוט, בנט, ליברמן וגולן התחייבות משותפת: ועדת חקירה ממלכתית לכשלי 7 באוקטובר תקום מיד עם הקמת הממשלה ה-38 בהובלתם.",
        ar: "في 8.9.2026 أصدر أيزنكوت وبينيت وليبرمان وغولان تعهدًا مشتركًا: ستُشكَّل لجنة تحقيق رسمية في إخفاقات 7 أكتوبر فور تشكيلهم الحكومة الـ38.",
        yi: "דעם 8.9.2026 האָבן איזנקוט, בנט, ליבערמאַן און גולן אַרויסגעגעבן אַ געמיינזאַמע התחייבות: אַ ממלכתישע חקירה־קאָמיסיע וועגן 7טן אָקטאָבער וועט אויפֿגעשטעלט ווערן גלײַך ווען זיי שאַפֿן די 38סטע רעגירונג.",
        ru: "8.9.2026 Айзенкот, Беннет, Либерман и Голан выступили с совместным обязательством: государственная комиссия по расследованию 7 октября будет создана сразу после формирования ими 38-го правительства.",
        uk: "8.9.2026 Айзенкот, Беннет, Ліберман і Ґолан оприлюднили спільне зобов’язання: державну комісію з розслідування 7 жовтня буде створено одразу після формування ними 38-го уряду.",
        en: "On 8.9.2026 Eisenkot, Bennett, Liberman and Golan issued a joint pledge: a state commission of inquiry into 7 October will be set up immediately when they form the 38th government.",
        am: "በ8.9.2026 አይዘንኮት፣ ቤኔት፣ ሊበርማን እና ጎላን የጋራ ቃል ኪዳን አወጡ፦ 38ኛውን መንግሥት እንደመሠረቱ ስለ ጥቅምት 7 የመንግሥት አጣሪ ኮሚሽን ወዲያውኑ ይቋቋማል።"
      }),
      sources: [src.koreJointPledge]
    },
    {
      id: "ctx-coalition-funds",
      question: "public-agreements",
      summary: L({
        he: "לפי הערכת N12, ביטול הכספים הקואליציוניים יחסוך כ-5 מיליארד ש\"ח, שחלק ניכר מהם כבר מוטמע בבסיס התקציב. הליכוד, ש\"ס, יהדות התורה, עוצמה יהודית והציונות הדתית לא פרסמו מצע כלכלי רשמי.",
        ar: "تقدّر N12 أن إلغاء الأموال الائتلافية سيوفر نحو 5 مليارات شيكل، وجزء كبير منها مدمج أصلًا في أساس الميزانية. لم تنشر الليكود وشاس ويهدوت هتوراه وعوتسما يهوديت والصهيونية الدينية برنامجًا اقتصاديًا رسميًا.",
        yi: "לויט N12 וועט אָפּשאַפֿן די קאָאַליציע־געלטער שפּאָרן אַרום 5 מיליאַרד שקל, אַ גרויסער טייל פֿון זיי איז שוין אַרײַנגעבויט אין דער באַזע פֿונעם בודזשעט. דער ליכוד, ש\"ס, יהדות התורה, עוצמה יהודית און די ציונות הדתית האָבן ניט פֿאַרעפֿנטלעכט קיין אָפֿיציעלע עקאָנאָמישע פּלאַטפֿאָרמע.",
        ru: "По оценке N12, отмена коалиционных денег сэкономила бы около 5 млрд шекелей, значительная часть которых уже встроена в базовый бюджет. «Ликуд», ШАС, «Яхадут ха-Тора», «Оцма Иегудит» и «Религиозный сионизм» не опубликовали официальной экономической программы.",
        uk: "За оцінкою N12, скасування коаліційних коштів заощадило б близько 5 млрд шекелів, значну частину яких уже вбудовано в базовий бюджет. «Лікуд», ШАС, «Ягадут га-Тора», «Оцма Єгудіт» і «Релігійний сіонізм» не оприлюднили офіційної економічної програми.",
        en: "N12 estimates that ending coalition funds would save about NIS 5 billion, much of it already built into the base budget. Likud, Shas, UTJ, Otzma Yehudit and Religious Zionism published no official economic platform.",
        am: "N12 እንደገመተው የጥምረት ገንዘቦችን ማስቀረት ወደ 5 ቢሊዮን ሼቄል ያድናል፤ ብዙው ግን አስቀድሞ በበጀቱ መሠረት ውስጥ ተካቷል። ሊኩድ፣ ሻስ፣ ዩናይትድ ቶራ ጁዳይዝም፣ ኦትዝማ የሁዲት እና ሃይማኖታዊ ጽዮናዊነት ኦፊሴላዊ የኢኮኖሚ መርሐ ግብር አላወጡም።"
      }),
      sources: [src.makoBudgets]
    }
  ],

  records: [
    // 3 — complying with court rulings
    {
      id: "pos-likud-court",
      partyId: "likud",
      question: "court-rulings",
      stance: "opposes",
      speaker: "list",
      summary: L({
        he: "החלטת הממשלה מ-5.7.2026 שלא להכיר בצו של בג\"ץ הוגשה בידי שרי הליכוד יריב לוין ושלמה קרעי.",
        ar: "اقترح وزيرا الليكود ياريف ليفين وشلومو كرعي قرار الحكومة في 5.7.2026 بعدم الاعتراف بأمر المحكمة العليا.",
        yi: "דעם רעגירונג־באַשלוס פֿון 5.7.2026 ניט צו אָנערקענען אַ צו פֿון בג\"ץ האָבן פֿאָרגעלייגט די ליכוד־מיניסטאָרן יריב לוין און שלמה קרעי.",
        ru: "Решение правительства от 5.7.2026 не признавать приказ БАГАЦа внесли министры от «Ликуда» Ярив Левин и Шломо Караи.",
        uk: "Рішення уряду від 5.7.2026 не визнавати наказ Багацу внесли міністри від «Лікуду» Ярів Левін і Шломо Караї.",
        en: "The government decision of 5.7.2026 not to recognise a High Court order was proposed by Likud ministers Yariv Levin and Shlomo Karhi.",
        am: "ከፍተኛው ፍርድ ቤት የሰጠውን ትእዛዝ ላለመቀበል የተወሰነውን የ5.7.2026 የመንግሥት ውሳኔ ያቀረቡት የሊኩድ ሚኒስትሮች ያሪቭ ሌቪን እና ሽሎሞ ካርሂ ናቸው።"
      }),
      sources: [src.ynetSecondAuthority]
    },
    {
      id: "pos-beyachad-court",
      partyId: "beyachad",
      question: "court-rulings",
      stance: "statement_available",
      speaker: lapid,
      summary: L({
        he: "כינה את סירוב הממשלה לכבד צו של בית המשפט ביולי 2026 המשבר החוקתי החמור ביותר בתולדות ישראל.",
        ar: "وصف رفض الحكومة احترام أمر قضائي في تموز/يوليو 2026 بأنه أخطر أزمة دستورية في تاريخ إسرائيل.",
        yi: "האָט אָנגערופֿן די רעגירונגס אָפּזאָג צו רעספּעקטירן אַ געריכט־צו אין יולי 2026 דעם ערגסטן קאָנסטיטוציאָנעלן קריזיס אין דער געשיכטע פֿון ישׂראל.",
        ru: "Назвал отказ правительства исполнить судебный приказ в июле 2026 года тягчайшим конституционным кризисом в истории Израиля.",
        uk: "Назвав відмову уряду виконати судовий наказ у липні 2026 року найтяжчою конституційною кризою в історії Ізраїлю.",
        en: "Called the government's July 2026 refusal to honour a court order the gravest constitutional crisis in Israel's history.",
        am: "መንግሥት በሐምሌ 2026 የፍርድ ቤት ትእዛዝን ለማክበር እምቢ ማለቱን በእስራኤል ታሪክ ውስጥ እጅግ ከባዱ ሕገ መንግሥታዊ ቀውስ ብሎታል።"
      }),
      sources: [src.makoJudiciary]
    },
    {
      id: "pos-dem-court",
      partyId: "the-democrats",
      question: "court-rulings",
      stance: "statement_available",
      speaker: "list",
      summary: L({
        he: "מתנגדת למנגנון התגברות שיאפשר לממשלה לעקוף את פסיקות בג\"ץ, ומתחייבת לבטל את חוקי המהפכה המשפטית.",
        ar: "تعارض آلية تغلّب تتيح للحكومة الالتفاف على أحكام المحكمة العليا، وتتعهد بإلغاء قوانين الانقلاب القضائي.",
        yi: "איז קעגן אַן התגברות־מעכאַניזם וואָס זאָל דערלויבן דער רעגירונג אויסצומײַדן פּסקים פֿון בג\"ץ, און זאָגט צו אָפּצושאַפֿן די געזעצן פֿון דער משפּטישער רעוואָלוציע.",
        ru: "Выступает против «преодолевающего» механизма, позволяющего правительству обходить решения БАГАЦа, и обещает отменить законы судебной реформы.",
        uk: "Виступає проти механізму подолання, що дозволив би уряду обходити рішення Багацу, і обіцяє скасувати закони судової реформи.",
        en: "Opposes an override mechanism that would let the government bypass High Court rulings, and pledges to repeal the judicial overhaul laws.",
        am: "መንግሥት የከፍተኛውን ፍርድ ቤት ውሳኔዎች እንዲያልፍ የሚያስችል የመሻሪያ ዘዴን ይቃወማል፤ የፍትሕ ሥርዓት ለውጥ ሕጎችንም ለመሻር ቃል ገብቷል።"
      }),
      sources: [src.makoJudiciary]
    },
    {
      id: "pos-shas-court",
      partyId: "shas",
      question: "court-rulings",
      stance: "statement_available",
      speaker: "list",
      summary: L({
        he: "כינתה צו ביניים של בג\"ץ נגד חוק מיולי 2026 אקטיביזם שיפוטי הדורס את הדמוקרטיה. לא הביעה עמדה על ציות לפסיקות.",
        ar: "وصفت أمرًا مؤقتًا للمحكمة العليا ضد قانون من تموز/يوليو 2026 بأنه نشاط قضائي يدوس الديمقراطية. لم تُبدِ موقفًا بشأن الامتثال للأحكام.",
        yi: "האָט אָנגערופֿן אַ צו ביניים פֿון בג\"ץ קעגן אַ געזעץ פֿון יולי 2026 משפּטישן אַקטיוויזם וואָס טרעט אויף דער דעמאָקראַטיע. קיין שטעלונג וועגן פֿאָלגן פּסקים האָט זי ניט אויסגעדריקט.",
        ru: "Назвала временный приказ БАГАЦа против закона июля 2026 года судебным активизмом, попирающим демократию. Позиции об исполнении решений не высказала.",
        uk: "Назвала тимчасовий наказ Багацу проти закону липня 2026 року судовим активізмом, що топче демократію. Позиції щодо виконання рішень не висловила.",
        en: "Called a High Court interim order against a July 2026 law judicial activism that tramples democracy. It stated no position on complying with rulings.",
        am: "በሐምሌ 2026 ሕግ ላይ ከፍተኛው ፍርድ ቤት የሰጠውን ጊዜያዊ ትእዛዝ ዴሞክራሲን የሚረግጥ የፍርድ ቤት አክቲቪዝም ብላዋለች። ውሳኔዎችን ስለማክበር አቋም አልገለጸችም።"
      }),
      sources: [src.makoJudiciary]
    },

    // 4 — disclosing possible coalitions
    {
      id: "pos-likud-coalition",
      partyId: "likud",
      question: "coalition-choices",
      stance: "statement_available",
      speaker: kisch,
      summary: L({
        he: "הליכוד ישאף לקואליציה רחבה גם עם 61 מנדטים; ליברמן \"אולי\" יוכל להצטרף; גולן לא בא בחשבון.",
        ar: "سيسعى الليكود إلى ائتلاف أوسع حتى مع 61 مقعدًا؛ ربما ينضم ليبرمان؛ غولان مستبعد.",
        yi: "דער ליכוד וועט זוכן אַ ברייטערע קאָאַליציע אַפֿילו מיט 61 מאַנדאַטן; ליבערמאַן קען \"אפֿשר\" זיך אָנשליסן; גולן איז אויסגעשלאָסן.",
        ru: "«Ликуд» будет добиваться более широкой коалиции даже при 61 мандате; Либерман «возможно» сможет присоединиться; Голан исключён.",
        uk: "«Лікуд» прагнутиме ширшої коаліції навіть із 61 мандатом; Ліберман «можливо» зможе приєднатися; Ґолана виключено.",
        en: "Likud would seek a wider coalition even with 61 seats; Liberman 'maybe' could join; Golan is ruled out.",
        am: "ሊኩድ 61 መቀመጫ ቢኖረውም ሰፋ ያለ ጥምረት ይፈልጋል፤ ሊበርማን 'ምናልባት' ሊቀላቀል ይችላል፤ ጎላን ግን አይታሰብም።"
      }),
      sources: [src.jpostKisch]
    },
    {
      id: "pos-beyachad-coalition",
      partyId: "beyachad",
      question: "coalition-choices",
      stance: "statement_available",
      speaker: "leader",
      summary: L({
        he: "תסתמך רק על מפלגות ציוניות; שוללת ישיבה עם נתניהו, גם ברוטציה, ועם עוצמה יהודית.",
        ar: "ستعتمد على الأحزاب الصهيونية فقط؛ تستبعد الجلوس مع نتنياهو، حتى في تناوب، ومع عوتسما يهوديت.",
        yi: "וועט זיך פֿאַרלאָזן נאָר אויף ציוניסטישע פּאַרטייען; שליסט אויס זיצן מיט נתניהו, אַפֿילו אין אַ ראָטאַציע, און מיט עוצמה יהודית.",
        ru: "Будет опираться только на сионистские партии; исключает сотрудничество с Нетаньяху, в том числе по ротации, и с «Оцма Иегудит».",
        uk: "Спиратиметься лише на сіоністські партії; виключає співпрацю з Нетаньягу, зокрема за ротацією, і з «Оцма Єгудіт».",
        en: "Will rely only on Zionist parties; rules out sitting with Netanyahu, including in a rotation, and with Otzma Yehudit.",
        am: "በጽዮናዊ ፓርቲዎች ላይ ብቻ ይመሠረታል፤ ከኔታንያሁ ጋር በዙር ሥልጣንም ቢሆን፣ እንዲሁም ከኦትዝማ የሁዲት ጋር መቀመጥን አይቀበልም።"
      }),
      sources: [src.makoBennett]
    },
    {
      id: "pos-yashar-coalition",
      partyId: "yashar",
      question: "coalition-choices",
      stance: "statement_available",
      speaker: "leader",
      summary: L({
        he: "לא ישב עם נתניהו \"בשום תרחיש\"; אינו מטיל חרם עקרוני על המפלגות החרדיות; רע\"ם אינה עומדת כיום בתנאיו ולא תהיה שותפה בממשלתו.",
        ar: "لن يجلس مع نتنياهو «في أي سيناريو»؛ لا يفرض مقاطعة مبدئية على الأحزاب الحريدية؛ القائمة الموحدة لا تستوفي شروطه حاليًا ولن تكون شريكة في حكومته.",
        yi: "וועט ניט זיצן מיט נתניהו \"אין קיין שום סצענאַר\"; לייגט ניט קיין פּרינציפּיעלן חרם אויף די חרדישע פּאַרטייען; רע\"ם שטימט איצט ניט מיט זײַנע תּנאָים און וועט ניט זײַן קיין שותּף אין זײַן רעגירונג.",
        ru: "Не будет сидеть с Нетаньяху «ни при каком сценарии»; не объявляет принципиального бойкота ультраортодоксальным партиям; РААМ сейчас не отвечает его условиям и не войдёт в его правительство.",
        uk: "Не сидітиме з Нетаньягу «за жодного сценарію»; не оголошує принципового бойкоту ультраортодоксальним партіям; РААМ наразі не відповідає його умовам і не ввійде до його уряду.",
        en: "Will not sit with Netanyahu 'in any scenario'; imposes no blanket boycott on the Haredi parties; Ra'am does not meet his conditions as things stand and will not be in his government.",
        am: "ከኔታንያሁ ጋር 'በምንም ሁኔታ' አይቀመጥም፤ በሐረዲ ፓርቲዎች ላይ መሠረታዊ ማግለል አይጥልም፤ ራአም በአሁኑ ጊዜ መሥፈርቶቹን አያሟላም፣ በመንግሥቱም ውስጥ አጋር አይሆንም።"
      }),
      sources: [src.iceBoycotts]
    },
    {
      id: "pos-yb-coalition",
      partyId: "yisrael-beiteinu",
      question: "coalition-choices",
      stance: "statement_available",
      speaker: "leader",
      summary: L({
        he: "לא ישב עם נתניהו, ש\"ס, יהדות התורה, רע\"ם או הרשימה המשותפת, ולא יתמוך בשום ממשלת מיעוט, גם לא זמנית; ליכוד בלי נתניהו יכול להיות שותף.",
        ar: "لن يجلس مع نتنياهو ولا شاس ولا يهدوت هتوراه ولا القائمة الموحدة ولا القائمة المشتركة، ولن يدعم أي حكومة أقلية حتى لو كانت انتقالية؛ الليكود من دون نتنياهو قد يكون شريكًا.",
        yi: "וועט ניט זיצן מיט נתניהו, ש\"ס, יהדות התורה, רע\"ם אָדער דער רשימה המשותפת, און וועט ניט שטיצן קיין מינאָריטעט־רעגירונג, אַפֿילו ניט קיין צײַטווײַליקע; אַ ליכוד אָן נתניהו קען זײַן אַ שותּף.",
        ru: "Не будет сидеть с Нетаньяху, ШАС, «Яхадут ха-Тора», РААМ или Объединённым списком и не поддержит никакое правительство меньшинства, даже переходное; «Ликуд» без Нетаньяху может стать партнёром.",
        uk: "Не сидітиме з Нетаньягу, ШАС, «Ягадут га-Тора», РААМ чи Об’єднаним списком і не підтримає жодного уряду меншості, навіть перехідного; «Лікуд» без Нетаньягу може стати партнером.",
        en: "Will not sit with Netanyahu, Shas, UTJ, Ra'am or the Joint List, and will back no minority government, even a transitional one; Likud without Netanyahu could be a partner.",
        am: "ከኔታንያሁ፣ ሻስ፣ ዩናይትድ ቶራ ጁዳይዝም፣ ራአም ወይም ከጋራ ዝርዝሩ ጋር አይቀመጥም፤ ጊዜያዊም ቢሆን ማንኛውንም አናሳ መንግሥት አይደግፍም፤ ኔታንያሁ የሌለበት ሊኩድ አጋር ሊሆን ይችላል።"
      }),
      sources: [src.iceBoycotts]
    },
    {
      id: "pos-dem-coalition",
      partyId: "the-democrats",
      question: "coalition-choices",
      stance: "statement_available",
      speaker: "leader",
      summary: L({
        he: "לא ישב עם נתניהו, הליכוד או כל מפלגה בקואליציה היוצאת; פתוח לשותפות יהודית-ערבית הכוללת את רע\"ם.",
        ar: "لن يجلس مع نتنياهو أو الليكود أو أي حزب في الائتلاف المنتهية ولايته؛ منفتح على شراكة يهودية-عربية تشمل القائمة الموحدة.",
        yi: "וועט ניט זיצן מיט נתניהו, דעם ליכוד אָדער סיי וועלכער פּאַרטיי אין דער אַוועקגייענדיקער קאָאַליציע; אָפֿן פֿאַר אַ ייִדיש־אַראַבישער שותּפֿות וואָס נעמט אַרײַן רע\"ם.",
        ru: "Не будет сидеть с Нетаньяху, «Ликудом» или любой партией уходящей коалиции; открыт к еврейско-арабскому партнёрству, включая РААМ.",
        uk: "Не сидітиме з Нетаньягу, «Лікудом» чи будь-якою партією чинної коаліції; відкритий до єврейсько-арабського партнерства, зокрема з РААМ.",
        en: "Will not sit with Netanyahu, Likud or any party in the outgoing coalition; open to a Jewish–Arab partnership that includes Ra'am.",
        am: "ከኔታንያሁ፣ ከሊኩድ ወይም ከተሰናባቹ ጥምረት ማንኛውም ፓርቲ ጋር አይቀመጥም፤ ራአምን ያካተተ የአይሁድ-ዐረብ አጋርነትን ይቀበላል።"
      }),
      sources: [src.iceBoycotts]
    },
    {
      id: "pos-shas-coalition",
      partyId: "shas",
      question: "coalition-choices",
      stance: "statement_available",
      speaker: "leader",
      summary: L({
        he: "לא תקים ולא תשביע ממשלה עד שיוסדר בחוק מעמד בני הישיבות, גם במחיר בחירות חוזרות.",
        ar: "لن تشكّل حكومة ولن تمنحها الثقة قبل تسوية وضع طلاب المدارس الدينية بقانون، حتى لو كلّف ذلك انتخابات معادة.",
        yi: "וועט ניט שאַפֿן און ניט באַשווערן קיין רעגירונג ביז דער סטאַטוס פֿון ישיבה־בחורים ווערט ניט געורדנט אין געזעץ, אַפֿילו אויפֿן פּרײַז פֿון נײַע וואַלן.",
        ru: "Не будет ни формировать, ни приводить к присяге правительство, пока статус учащихся ешив не урегулирован законом, даже ценой повторных выборов.",
        uk: "Не формуватиме й не приводитиме до присяги уряд, доки статус учнів єшив не врегульовано законом, навіть ціною повторних виборів.",
        en: "Will neither form nor swear in a government until the status of yeshiva students is settled in law, even at the cost of repeat elections.",
        am: "የየሺቫ ተማሪዎች ሁኔታ በሕግ እስኪደነገግ ድረስ፣ ድጋሚ ምርጫ ቢያስከትልም መንግሥት አትመሠርትም፣ አታስምልም።"
      }),
      sources: [src.emessDeri]
    },
    {
      id: "pos-utj-coalition",
      partyId: "utj",
      question: "coalition-choices",
      stance: "statement_available",
      speaker: "leader",
      summary: L({
        he: "לא תיכנס ולא תתמוך מבחוץ בשום ממשלה שלא תעביר בפועל את חוק הגיוס תחילה.",
        ar: "لن تنضم إلى أي حكومة ولن تدعمها من الخارج ما لم تُقرّ قانون التجنيد فعليًا أولًا.",
        yi: "וועט זיך ניט אָנשליסן און ניט שטיצן פֿון דרויסן קיין רעגירונג וואָס וועט ניט פֿאַקטיש דורכפֿירן דאָס גיוס־געזעץ פֿריִער.",
        ru: "Не войдёт и не поддержит извне никакое правительство, которое сначала фактически не примет закон о призыве.",
        uk: "Не ввійде й не підтримає ззовні жоден уряд, який спершу фактично не ухвалить закону про призов.",
        en: "Will not join, or back from outside, any government that does not actually pass the draft law first.",
        am: "የምልመላ ሕጉን በቅድሚያ በተግባር የማያጸድቅን ማንኛውንም መንግሥት አትቀላቀልም፣ ከውጭም አትደግፍም።"
      }),
      sources: [src.kikarAsher]
    },
    {
      id: "pos-rz-coalition",
      partyId: "religious-zionism",
      question: "coalition-choices",
      stance: "statement_available",
      speaker: feiglin,
      summary: L({
        he: "ימליץ על נתניהו בפני הנשיא; מתנה הצטרפות לקואליציה בכך שלא ייכנסו משאיות סיוע לעזה.",
        ar: "سيوصي بنتنياهو أمام الرئيس؛ يشترط للانضمام إلى الائتلاف عدم دخول شاحنات المساعدات إلى غزة.",
        yi: "וועט רעקאָמענדירן נתניהו פֿאַרן פּרעזידענט; שטעלט אַ תּנאַי פֿאַר אָנשליסן זיך צו אַ קאָאַליציע אַז קיין הילף־טראָקן זאָלן ניט אַרײַנפֿאָרן קיין עזה.",
        ru: "Порекомендует президенту Нетаньяху; условием вхождения в коалицию ставит прекращение въезда грузовиков с гуманитарной помощью в Газу.",
        uk: "Рекомендуватиме президентові Нетаньягу; умовою входження до коаліції ставить припинення в’їзду вантажівок із гуманітарною допомогою до Гази.",
        en: "Will recommend Netanyahu to the President; conditions joining a coalition on no aid trucks entering Gaza.",
        am: "ኔታንያሁን ለፕሬዚዳንቱ ይመክራል፤ ጥምረቱን ለመቀላቀል የእርዳታ መኪኖች ወደ ጋዛ እንዳይገቡ ቅድመ ሁኔታ ያደርጋል።"
      }),
      sources: [src.iceBoycotts]
    },
    {
      id: "pos-otzma-coalition",
      partyId: "otzma-yehudit",
      question: "coalition-choices",
      stance: "statement_available",
      speaker: "leader",
      summary: L({
        he: "ידרוש בממשלה הבאה את תיק הביטחון לבן גביר ואת תיק המשפטים לטלי גוטליב, בהתאם למספר המנדטים.",
        ar: "سيطالب في الحكومة المقبلة بحقيبة الدفاع لبن غفير وحقيبة العدل لتالي غوتليب، تبعًا لعدد المقاعد.",
        yi: "וועט מאָנען אין דער קומענדיקער רעגירונג דעם ביטחון־פּאָרטפֿעל פֿאַר בן גביר און דעם יוסטיץ־פּאָרטפֿעל פֿאַר טלי גוטליב, לויט דער צאָל מאַנדאַטן.",
        ru: "Потребует в следующем правительстве пост министра обороны для Бен-Гвира и министра юстиции для Тали Готлив — в зависимости от числа мандатов.",
        uk: "Вимагатиме в наступному уряді посаду міністра оборони для Бен-Ґвіра та міністра юстиції для Талі Ґотлів — залежно від кількості мандатів.",
        en: "Will demand the Defence Ministry for Ben Gvir and the Justice Ministry for Tali Gotliv in the next government, depending on the seats won.",
        am: "በሚቀጥለው መንግሥት እንደሚያገኘው መቀመጫ ብዛት የመከላከያ ሚኒስቴርን ለቤን ግቪር፣ የፍትሕ ሚኒስቴርን ደግሞ ለታሊ ጎትሊቭ ይጠይቃል።"
      }),
      sources: [src.ynetBenGvir]
    },
    {
      id: "pos-amcha-coalition",
      partyId: "amcha-yisrael",
      question: "coalition-choices",
      stance: "statement_available",
      speaker: "leader",
      summary: L({
        he: "יתמוך בנתניהו; לא יכהן תחת בנט או ליברמן; שולל שיתוף פעולה עם המפלגות הערביות.",
        ar: "سيدعم نتنياهو؛ لن يخدم تحت بينيت أو ليبرمان؛ يستبعد التعاون مع الأحزاب العربية.",
        yi: "וועט שטיצן נתניהו; וועט ניט דינען אונטער בנט אָדער ליבערמאַן; שליסט אויס מיטאַרבעט מיט די אַראַבישע פּאַרטייען.",
        ru: "Поддержит Нетаньяху; не будет служить под началом Беннета или Либермана; исключает сотрудничество с арабскими партиями.",
        uk: "Підтримає Нетаньягу; не служитиме під проводом Беннета чи Лібермана; виключає співпрацю з арабськими партіями.",
        en: "Will support Netanyahu; will not serve under Bennett or Liberman; rules out working with the Arab parties.",
        am: "ኔታንያሁን ይደግፋል፤ በቤኔት ወይም በሊበርማን ሥር አያገለግልም፤ ከዐረብ ፓርቲዎች ጋር መሥራትን አይቀበልም።"
      }),
      sources: [src.iceBoycotts]
    },
    {
      id: "pos-raam-coalition",
      partyId: "raam",
      question: "coalition-choices",
      stance: "statement_available",
      speaker: "leader",
      summary: L({
        he: "שולל כל שיתוף פעולה עם נתניהו; שואף להחליף את הממשלה ב\"ממשלת שינוי\".",
        ar: "يستبعد أي تعاون مع نتنياهو؛ يسعى إلى استبدال الحكومة بـ«حكومة تغيير».",
        yi: "שליסט אויס יעדן מיטאַרבעט מיט נתניהו; שטרעבט צו פֿאַרבײַטן די רעגירונג מיט אַ \"רעגירונג פֿון ענדערונג\".",
        ru: "Исключает любое сотрудничество с Нетаньяху; стремится заменить правительство «правительством перемен».",
        uk: "Виключає будь-яку співпрацю з Нетаньягу; прагне замінити уряд «урядом змін».",
        en: "Rules out any cooperation with Netanyahu; aims to replace the government with a 'change government'.",
        am: "ከኔታንያሁ ጋር ማንኛውንም ትብብር አይቀበልም፤ መንግሥቱን በ'የለውጥ መንግሥት' ለመተካት ያልማል።"
      }),
      sources: [src.france24Abbas]
    },
    {
      id: "pos-joint-coalition",
      partyId: "joint-list",
      question: "coalition-choices",
      stance: "statement_available",
      speaker: "leader",
      summary: L({
        he: "מציעה רשת ביטחון פרלמנטרית מבחוץ לכל ממשלה שתסיים את שלטון נתניהו, בתנאים: תוכנית מתוקצבת נגד הפשיעה, הפסקת הריסת בתים ואופק למדינה פלסטינית.",
        ar: "تعرض شبكة أمان برلمانية من الخارج لأي حكومة تُنهي حكم نتنياهو، بشروط: خطة ممولة لمكافحة الجريمة، ووقف هدم البيوت، وأفق لدولة فلسطينية.",
        yi: "באַטט אָן אַ פּאַרלאַמענטאַרישע זיכערהייט־נעץ פֿון דרויסן פֿאַר יעדער רעגירונג וואָס ענדיקט נתניהוס הערשאַפֿט, מיט תּנאָים: אַ באַבודזשעטירטער פּלאַן קעגן קרימינאַליטעט, אַן אָפּשטעל פֿון הײַזער־צעשטערונג און אַ האָריזאָנט צו אַ פּאַלעסטינער מדינה.",
        ru: "Предлагает внешнюю парламентскую «страховочную сеть» любому правительству, которое положит конец правлению Нетаньяху, на условиях: финансируемый план борьбы с преступностью, прекращение сноса домов и путь к палестинскому государству.",
        uk: "Пропонує зовнішню парламентську «страхувальну сітку» будь-якому уряду, що покладе край правлінню Нетаньягу, за умов: фінансований план боротьби зі злочинністю, припинення знесення будинків і шлях до палестинської держави.",
        en: "Offers an outside parliamentary safety net to any government that ends Netanyahu's rule, on conditions: a budgeted anti-crime plan, an end to home demolitions and a path to a Palestinian state.",
        am: "የኔታንያሁን አገዛዝ ለሚያበቃ ማንኛውም መንግሥት ከውጭ የፓርላማ ድጋፍ መረብ ታቀርባለች፤ ቅድመ ሁኔታዎቹ፦ በጀት ያለው የወንጀል መከላከያ ዕቅድ፣ የቤት ፈረሳ ማቆም እና ወደ ፍልስጤም መንግሥት የሚያመራ መንገድ ናቸው።"
      }),
      sources: [src.makoJointList]
    },
    {
      id: "pos-reservists-coalition",
      partyId: "reservists-economy",
      question: "coalition-choices",
      stance: "statement_available",
      speaker: "leader",
      summary: L({
        he: "יהיה חלק בממשלת אחדות עם נתניהו, בנט ואיזנקוט; לא יצטרף לממשלה בלי חוק גיוס או עם מפלגות ערביות.",
        ar: "سيشارك في حكومة وحدة مع نتنياهو وبينيت وأيزنكوت؛ لن ينضم إلى حكومة من دون قانون تجنيد أو مع أحزاب عربية.",
        yi: "וועט זײַן אַ טייל פֿון אַן אחדות־רעגירונג מיט נתניהו, בנט און איזנקוט; וועט זיך ניט אָנשליסן צו אַ רעגירונג אָן אַ גיוס־געזעץ אָדער מיט אַראַבישע פּאַרטייען.",
        ru: "Войдёт в правительство единства с Нетаньяху, Беннетом и Айзенкотом; не войдёт в правительство без закона о призыве или с арабскими партиями.",
        uk: "Увійде до уряду єдності з Нетаньягу, Беннетом і Айзенкотом; не ввійде до уряду без закону про призов або з арабськими партіями.",
        en: "Would take part in a unity government with Netanyahu, Bennett and Eisenkot; will not join a government without a draft law or with Arab parties.",
        am: "ከኔታንያሁ፣ ቤኔት እና አይዘንኮት ጋር በብሔራዊ አንድነት መንግሥት ውስጥ ይሳተፋል፤ የምልመላ ሕግ የሌለውን ወይም ዐረብ ፓርቲዎችን ያካተተ መንግሥት አይቀላቀልም።"
      }),
      sources: [src.markerHendel]
    },

    {
      id: "pos-noam-coalition",
      partyId: "noam",
      question: "coalition-choices",
      stance: "statement_available",
      speaker: "list",
      summary: L({
        he: "מתחייבת לדרוש שחקיקת פסקת ההתגברות תעבור עוד לפני השבעת הממשלה הבאה, כתנאי מקדים ולא כהבטחה לעתיד.",
        ar: "تتعهد بأن تشترط إقرار فقرة التغلب قبل أداء الحكومة المقبلة اليمين، شرطًا مسبقًا لا وعدًا مؤجلًا.",
        yi: "זאָגט צו צו פֿאָדערן אַז דאָס געזעץ פֿון דער פּסקת התגברות זאָל דורכגיין נאָך פֿאַר דער באַשווערונג פֿון דער קומענדיקער רעגירונג, ווי אַ פֿאָרויס־תּנאַי און ניט קיין צוזאָג אויף שפּעטער.",
        ru: "Обязуется требовать принятия «преодолевающей оговорки» ещё до присяги следующего правительства — как предварительного условия, а не обещания на будущее.",
        uk: "Зобов’язується вимагати ухвалення «положення про подолання» ще до присяги наступного уряду — як попередньої умови, а не обіцянки на майбутнє.",
        en: "Commits to requiring that an override clause is legislated before the next government is sworn in, as a precondition rather than a later promise.",
        am: "የመሻሪያ አንቀጹ የሚቀጥለው መንግሥት ከመማሉ በፊት እንዲጸድቅ፣ ለወደፊት ቃል ሳይሆን ቅድመ ሁኔታ አድርጎ ለመጠየቅ ቃል ገብቷል።"
      }),
      sources: [src.kikarNoam]
    },

    // 5 — size of the government
    {
      id: "pos-yashar-size",
      partyId: "yashar",
      question: "government-size",
      stance: "supports_with_reservations",
      speaker: "list",
      summary: L({
        he: "טיוטת תוכנית 100 הימים מצמצמת את משרדי הממשלה מ-31 ל-24; המפלגה רואה ב-18 יעד אידיאלי אך שאפתני מדי.",
        ar: "تقلّص مسودة خطة المئة يوم الوزارات من 31 إلى 24؛ ويرى الحزب أن 18 هو الهدف المثالي لكنه طموح جدًا حاليًا.",
        yi: "דער אָנוואַרף פֿונעם 100־טעג־פּלאַן רעדוצירט די מיניסטעריעס פֿון 31 אויף 24; די פּאַרטיי האַלט 18 פֿאַר דעם אידעאַל, נאָר צו אַמביציעז דערווײַל.",
        ru: "Проект плана на 100 дней сокращает число министерств с 31 до 24; партия называет идеалом 18, но пока слишком амбициозным.",
        uk: "Проєкт плану на 100 днів скорочує кількість міністерств із 31 до 24; партія називає ідеалом 18, але наразі надто амбітним.",
        en: "Draft 100-day plan cuts ministries from 31 to 24; the party calls 18 its ideal but too ambitious for now.",
        am: "የ100 ቀናት ረቂቅ ዕቅዱ ሚኒስቴሮችን ከ31 ወደ 24 ይቀንሳል፤ ፓርቲው 18ን ተስማሚ ግብ ቢለውም ለአሁኑ እጅግ ትልቅ ምኞት ነው ይላል።"
      }),
      sources: [src.ynet100Days]
    },
    {
      id: "pos-yb-size",
      partyId: "yisrael-beiteinu",
      question: "government-size",
      stance: "supports_with_reservations",
      speaker: "list",
      summary: L({
        he: "המצע: צמצום מספר השרים וביטול משרדי ממשלה מיותרים. לא נקבע מספר.",
        ar: "البرنامج: تقليص عدد الوزراء وإلغاء الوزارات الزائدة. لم يُحدَّد عدد.",
        yi: "די פּלאַטפֿאָרמע: רעדוצירן די צאָל מיניסטאָרן און אָפּשאַפֿן איבעריקע מיניסטעריעס. קיין צאָל איז ניט באַשטימט.",
        ru: "Программа: сократить число министров и упразднить лишние министерства. Конкретное число не указано.",
        uk: "Програма: скоротити кількість міністрів і ліквідувати зайві міністерства. Конкретне число не вказано.",
        en: "Platform: reduce the number of ministers and abolish redundant ministries. No number is given.",
        am: "መርሐ ግብሩ፦ የሚኒስትሮችን ቁጥር መቀነስ እና አላስፈላጊ ሚኒስቴሮችን ማስቀረት። ቁጥር አልተጠቀሰም።"
      }),
      sources: [src.beytenuPlatform]
    },

    // 7 — first-100-days programme
    {
      id: "pos-yashar-100",
      partyId: "yashar",
      question: "first-100-days",
      stance: "supports_with_reservations",
      speaker: "list",
      summary: L({
        he: "ynet השיג טיוטות של תוכנית 100 ימים: ועדת חקירה ממלכתית בראש, שירות לכולם, ביטול חוקי המהפכה המשפטית וצמצום משרדים. לא פורטו מועדים וגורמים אחראים.",
        ar: "حصل موقع Ynet على مسودات خطة المئة يوم: لجنة تحقيق رسمية أولًا، وخدمة للجميع، وإلغاء قوانين الانقلاب القضائي، وتقليص الوزارات. لم تُحدَّد مواعيد ولا جهات مسؤولة.",
        yi: "Ynet האָט באַקומען אָנוואַרפֿן פֿון אַ 100־טעג־פּלאַן: צו ערשט אַ ממלכתישע חקירה־קאָמיסיע, דינסט פֿאַר אַלעמען, אָפּשאַפֿן די געזעצן פֿון דער משפּטישער רעוואָלוציע און ווייניקער מיניסטעריעס. טערמינען און פֿאַראַנטוואָרטלעכע גופֿים זײַנען ניט אָנגעגעבן.",
        ru: "Ynet получил проекты плана на 100 дней: первым пунктом — государственная комиссия по расследованию, затем всеобщая служба, отмена законов судебной реформы и сокращение министерств. Сроки и ответственные органы не указаны.",
        uk: "Ynet отримав проєкти плану на 100 днів: першим пунктом — державна комісія з розслідування, далі загальна служба, скасування законів судової реформи та скорочення міністерств. Строків і відповідальних органів не вказано.",
        en: "Ynet obtained drafts of a 100-day plan: a state commission of inquiry first, then universal service, repeal of the overhaul laws and fewer ministries. Deadlines and responsible bodies are not given.",
        am: "Ynet የ100 ቀናት ዕቅድ ረቂቆችን አግኝቷል፦ በመጀመሪያ የመንግሥት አጣሪ ኮሚሽን፣ ከዚያ ለሁሉም አገልግሎት፣ የፍትሕ ለውጥ ሕጎችን መሻር እና ሚኒስቴሮችን መቀነስ። የጊዜ ገደቦችና ኃላፊ አካላት አልተገለጹም።"
      }),
      sources: [src.ynet100Days]
    },
    {
      id: "pos-beyachad-100",
      partyId: "beyachad",
      question: "first-100-days",
      stance: "statement_available",
      speaker: "list",
      summary: L({
        he: "לדבריה, התוכניות מוכנות ליישום מהיום הראשון של הממשלה החדשה; לא פורסם לוח זמנים ל-100 ימים.",
        ar: "تقول إن خططها جاهزة للتنفيذ منذ اليوم الأول للحكومة الجديدة؛ لم يُنشر جدول زمني للمئة يوم.",
        yi: "זאָגט אַז אירע פּלענער זײַנען גרייט צו דורכפֿירן פֿונעם ערשטן טאָג פֿון דער נײַער רעגירונג; קיין 100־טעג־לוח איז ניט פֿאַרעפֿנטלעכט.",
        ru: "Заявляет, что её планы готовы к выполнению с первого дня нового правительства; графика на 100 дней не опубликовано.",
        uk: "Заявляє, що її плани готові до виконання з першого дня нового уряду; графіка на 100 днів не оприлюднено.",
        en: "Says its plans are ready to carry out from the new government's first day; no 100-day timetable is published.",
        am: "ዕቅዶቹ ከአዲሱ መንግሥት የመጀመሪያ ቀን ጀምሮ ለትግበራ ዝግጁ ናቸው ይላል፤ የ100 ቀናት የጊዜ ሰሌዳ አልታተመም።"
      }),
      sources: [src.beyahadPlans]
    },

    {
      id: "pos-dem-100",
      partyId: "the-democrats",
      question: "first-100-days",
      stance: "supports_with_reservations",
      speaker: "leader",
      summary: L({
        he: "פרסם תוכנית מדינית-ביטחונית ל-100 הימים הראשונים בממשלה הבאה: עזה, יהודה ושומרון, לבנון ואיראן. אין בה מועדים, גורמים אחראים או תקציב לכל צעד.",
        ar: "نشر خطة سياسية-أمنية للمئة يوم الأولى في الحكومة المقبلة: غزة والضفة الغربية ولبنان وإيران. لا تتضمن مواعيد أو جهات مسؤولة أو ميزانية لكل خطوة.",
        yi: "האָט פֿאַרעפֿנטלעכט אַ מדיניש־זיכערהייט־פּלאַן פֿאַר די ערשטע 100 טעג פֿון דער קומענדיקער רעגירונג: עזה, יהודה און שומרון, לבנון און איראַן. ער האָט ניט קיין טערמינען, פֿאַראַנטוואָרטלעכע גופֿים אָדער בודזשעט פֿאַר יעדן שריט.",
        ru: "Опубликовал политико-оборонный план на первые 100 дней следующего правительства: Газа, Иудея и Самария, Ливан и Иран. Сроков, ответственных органов и бюджета по шагам в нём нет.",
        uk: "Оприлюднив політико-оборонний план на перші 100 днів наступного уряду: Газа, Юдея і Самарія, Ліван та Іран. Строків, відповідальних органів і бюджету за кроками в ньому немає.",
        en: "Published a diplomatic and security plan for the next government's first 100 days: Gaza, the West Bank, Lebanon and Iran. It gives no deadlines, responsible bodies or budget per step.",
        am: "ለሚቀጥለው መንግሥት የመጀመሪያ 100 ቀናት የዲፕሎማሲና የደህንነት ዕቅድ አውጥቷል፦ ጋዛ፣ ዌስት ባንክ፣ ሊባኖስ እና ኢራን። ለእያንዳንዱ እርምጃ የጊዜ ገደብ፣ ኃላፊ አካል ወይም በጀት የለውም።"
      }),
      sources: [src.makoGolan100]
    },

    // 8 — state commission of inquiry into 7 October
    {
      id: "pos-yashar-inquiry",
      partyId: "yashar",
      question: "october-7-inquiry",
      stance: "supports",
      speaker: "list",
      summary: L({
        he: "ועדת חקירה ממלכתית לפי סעיף 1 לחוק ועדות חקירה, כ\"החלטת הממשלה הראשונה שלנו\".",
        ar: "لجنة تحقيق رسمية بموجب البند 1 من قانون لجان التحقيق، بوصفها «أول قرار لحكومتنا».",
        yi: "אַ ממלכתישע חקירה־קאָמיסיע לויט פּאַראַגראַף 1 פֿונעם חוק ועדות חקירה, ווי \"אונדזער ערשטער רעגירונג־באַשלוס\".",
        ru: "Государственная комиссия по статье 1 Закона о комиссиях по расследованию — как «первое решение нашего правительства».",
        uk: "Державна комісія за статтею 1 Закону про комісії з розслідування — як «перше рішення нашого уряду».",
        en: "A state commission under section 1 of the Commissions of Inquiry Law, as 'our first government decision'.",
        am: "በአጣሪ ኮሚሽኖች ሕግ አንቀጽ 1 መሠረት የመንግሥት አጣሪ ኮሚሽን፣ 'የመንግሥታችን የመጀመሪያ ውሳኔ' ሆኖ።"
      }),
      sources: [src.ynetInquiry]
    },
    {
      id: "pos-beyachad-inquiry",
      partyId: "beyachad",
      question: "october-7-inquiry",
      stance: "supports",
      speaker: "list",
      summary: L({
        he: "ועדת חקירה ממלכתית \"כלשון החוק\", בתוך חמש הדקות הראשונות של ישיבת הממשלה הראשונה.",
        ar: "لجنة تحقيق رسمية «كما ينص القانون»، خلال الدقائق الخمس الأولى من أول جلسة للحكومة.",
        yi: "אַ ממלכתישע חקירה־קאָמיסיע \"ווי דאָס געזעץ באַשטימט\", אין די ערשטע פֿינף מינוט פֿון דער ערשטער רעגירונג־זיצונג.",
        ru: "Государственная комиссия «в точности по закону» — в первые пять минут первого заседания правительства.",
        uk: "Державна комісія «точно за законом» — у перші п’ять хвилин першого засідання уряду.",
        en: "A state commission 'as the law defines it', within the first five minutes of the first cabinet meeting.",
        am: "'ሕጉ እንደሚደነግገው' የመንግሥት አጣሪ ኮሚሽን፣ በመጀመሪያው የካቢኔ ስብሰባ የመጀመሪያ አምስት ደቂቃዎች ውስጥ።"
      }),
      sources: [src.ynetInquiry]
    },
    {
      id: "pos-yb-inquiry",
      partyId: "yisrael-beiteinu",
      question: "october-7-inquiry",
      stance: "supports",
      speaker: "list",
      summary: L({
        he: "ועדת חקירה ממלכתית בדיוק לפי החוק הקיים, כהחלטה הראשונה של ממשלה שתקים.",
        ar: "لجنة تحقيق رسمية وفق القانون القائم تمامًا، كأول قرار لحكومة يشكّلها.",
        yi: "אַ ממלכתישע חקירה־קאָמיסיע פּונקט לויט דעם איצטיקן געזעץ, ווי דער ערשטער באַשלוס פֿון אַ רעגירונג וואָס זי וועט שאַפֿן.",
        ru: "Государственная комиссия строго по действующему закону — первым решением сформированного ею правительства.",
        uk: "Державна комісія суворо за чинним законом — першим рішенням сформованого нею уряду.",
        en: "A state commission exactly as current law provides, as the first decision of a government it forms.",
        am: "አሁን ባለው ሕግ መሠረት በትክክል የመንግሥት አጣሪ ኮሚሽን፣ የሚመሠርተው መንግሥት የመጀመሪያ ውሳኔ ሆኖ።"
      }),
      sources: [src.ynetInquiry, src.beytenuPlatform]
    },
    {
      id: "pos-dem-inquiry",
      partyId: "the-democrats",
      question: "october-7-inquiry",
      stance: "supports",
      speaker: "list",
      summary: L({
        he: "ועדת חקירה ממלכתית שחבריה ימונו בידי נשיא העליון, כהחלטה הראשונה של הממשלה הבאה; היקפה כולל את שרשרת ההחלטות, ניהול המלחמה ועסקאות החטופים.",
        ar: "لجنة تحقيق رسمية يعيّن أعضاءها رئيس المحكمة العليا، كأول قرار للحكومة المقبلة؛ ويشمل نطاقها سلسلة القرارات وإدارة الحرب وصفقات الرهائن.",
        yi: "אַ ממלכתישע חקירה־קאָמיסיע וועמענס מיטגלידער באַשטימט דער פּרעזידענט פֿונעם העכסטן געריכט, ווי דער ערשטער באַשלוס פֿון דער קומענדיקער רעגירונג; זי דעקט די קייט פֿון באַשלוסן, די פֿירונג פֿון דער מלחמה און די אָפּמאַכן וועגן די געכאַפּטע.",
        ru: "Государственная комиссия, члены которой назначаются председателем Верховного суда, — первым решением следующего правительства; охватывает цепочку решений, ведение войны и сделки по заложникам.",
        uk: "Державна комісія, членів якої призначає голова Верховного суду, — першим рішенням наступного уряду; охоплює ланцюг рішень, ведення війни та угоди щодо заручників.",
        en: "A state commission with members appointed by the Supreme Court president, as the next government's first decision; its scope covers the chain of decisions, the conduct of the war and the hostage deals.",
        am: "አባላቱ በጠቅላይ ፍርድ ቤቱ ፕሬዚዳንት የሚሾሙበት የመንግሥት አጣሪ ኮሚሽን፣ የሚቀጥለው መንግሥት የመጀመሪያ ውሳኔ ሆኖ፤ የውሳኔዎችን ሰንሰለት፣ የጦርነቱን አመራር እና የታጋቾች ስምምነቶችን ይሸፍናል።"
      }),
      sources: [src.ynetInquiry]
    },
    {
      id: "pos-joint-inquiry",
      partyId: "joint-list",
      question: "october-7-inquiry",
      stance: "supports_with_reservations",
      speaker: "list",
      summary: L({
        he: "ועדת חקירה ממלכתית לפי החוק הקיים, בראשות שופט עליון ובמינוי נשיא בית המשפט העליון, עם מנדט רחב יותר. ללא לוח זמנים.",
        ar: "لجنة تحقيق رسمية وفق القانون القائم، يرأسها قاضٍ في المحكمة العليا ويعيّنها رئيس المحكمة، مع تفويض أوسع. دون جدول زمني.",
        yi: "אַ ממלכתישע חקירה־קאָמיסיע לויטן איצטיקן געזעץ, אונטער אַ שופֿט פֿונעם העכסטן געריכט און באַשטימט פֿונעם געריכט־פּרעזידענט, מיט אַ ברייטערן מאַנדאַט. אָן אַ לוח זמנים.",
        ru: "Государственная комиссия по действующему закону во главе с судьёй Верховного суда, назначаемая его председателем, с расширенным мандатом. Без сроков.",
        uk: "Державна комісія за чинним законом на чолі із суддею Верховного суду, яку призначає його голова, з розширеним мандатом. Без строків.",
        en: "A state commission under existing law, chaired by a Supreme Court justice and appointed by the court's president, with a wider mandate. No timetable.",
        am: "አሁን ባለው ሕግ መሠረት፣ በጠቅላይ ፍርድ ቤት ዳኛ የሚመራና በፍርድ ቤቱ ፕሬዚዳንት የሚሾም፣ ሰፋ ያለ ሥልጣን ያለው የመንግሥት አጣሪ ኮሚሽን። የጊዜ ሰሌዳ የለም።"
      }),
      sources: [src.ynetInquiry]
    },
    {
      id: "pos-reservists-inquiry",
      partyId: "reservists-economy",
      question: "october-7-inquiry",
      stance: "supports_with_reservations",
      speaker: "list",
      summary: L({
        he: "תומכת בוועדת חקירה ממלכתית, רצוי בהסכמה רחבה, במינוי בית המשפט העליון. ללא לוח זמנים.",
        ar: "تؤيد لجنة تحقيق رسمية، ويُفضَّل باتفاق واسع، تعيّنها المحكمة العليا. دون جدول زمني.",
        yi: "שטיצט אַ ממלכתישע חקירה־קאָמיסיע, בעסער מיט אַ ברייטער הסכּמה, באַשטימט פֿונעם העכסטן געריכט. אָן אַ לוח זמנים.",
        ru: "Поддерживает государственную комиссию, желательно по широкому согласию, назначаемую Верховным судом. Без сроков.",
        uk: "Підтримує державну комісію, бажано за широкою згодою, яку призначає Верховний суд. Без строків.",
        en: "Supports a state commission, preferably by broad agreement, appointed by the Supreme Court. No timetable.",
        am: "በጠቅላይ ፍርድ ቤቱ የሚሾም፣ ቢቻል በሰፊ ስምምነት የሚቋቋም የመንግሥት አጣሪ ኮሚሽንን ትደግፋለች። የጊዜ ሰሌዳ የለም።"
      }),
      sources: [src.ynetInquiry]
    },
    {
      id: "pos-raam-inquiry",
      partyId: "raam",
      question: "october-7-inquiry",
      stance: "statement_available",
      speaker: "list",
      summary: L({
        he: "תומכת בחקירה מקיפה, עצמאית ובלתי משוחדת, אך אומרת שאינה בעדיפות כעת. ללא מתכונת או לוח זמנים.",
        ar: "تؤيد تحقيقًا شاملًا ومستقلًا ونزيهًا، لكنها تقول إنه ليس أولوية حاليًا. دون صيغة أو جدول زمني.",
        yi: "שטיצט אַ פֿולשטענדיקע, אומאָפּהענגיקע און אומפּאַרטייאישע חקירה, נאָר זאָגט אַז דאָס איז איצט ניט קיין פּריאָריטעט. אָן אַ פֿאָרמאַט אָדער לוח זמנים.",
        ru: "Поддерживает всестороннее, независимое и беспристрастное расследование, но считает его сейчас не приоритетом. Без формата и сроков.",
        uk: "Підтримує всебічне, незалежне й неупереджене розслідування, але вважає його зараз не пріоритетом. Без формату й строків.",
        en: "Supports a comprehensive, independent and impartial inquiry but says it is not a current priority. No format or timetable.",
        am: "ሁሉን አቀፍ፣ ገለልተኛ እና ፍትሐዊ ምርመራን ትደግፋለች፤ ሆኖም አሁን ቅድሚያ የሚሰጠው ጉዳይ አይደለም ትላለች። ቅርጸትም ሆነ የጊዜ ሰሌዳ የለም።"
      }),
      sources: [src.ynetInquiry]
    },
    {
      id: "pos-rz-inquiry",
      partyId: "religious-zionism",
      question: "october-7-inquiry",
      stance: "opposes",
      speaker: "list",
      summary: L({
        he: "\"לא נתמוך בשום פנים ואופן\" בוועדת חקירה ממלכתית; תומכת במקומה בוועדה \"לאומית\". זהות מבקשת ועדה \"ניטרלית\" בעלת סמכויות בלתי מוגבלות.",
        ar: "لن تدعم «بأي حال» لجنة تحقيق رسمية، وتؤيد بدلًا منها لجنة «قومية». وتريد «زهوت» لجنة «محايدة» بصلاحيات غير محدودة.",
        yi: "וועט \"אין קיין פֿאַל ניט\" שטיצן אַ ממלכתישע חקירה־קאָמיסיע; שטיצט אַנשטאָט דעם אַ \"נאַציאָנאַלע\" קאָמיסיע. זהות וויל אַ \"נייטראַלע\" קאָמיסיע מיט אומבאַגרענעצטע סמכויות.",
        ru: "«Ни в коем случае» не поддержит государственную комиссию; вместо неё поддерживает «национальную». «Зеут» хочет «нейтральную» комиссию с неограниченными полномочиями.",
        uk: "«У жодному разі» не підтримає державну комісію; натомість підтримує «національну». «Зеут» хоче «нейтральну» комісію з необмеженими повноваженнями.",
        en: "Will 'in no way' support a state commission, and backs a 'national' commission instead. Zehut wants a 'neutral' commission with unlimited powers.",
        am: "የመንግሥት አጣሪ ኮሚሽንን 'በምንም መንገድ' አትደግፍም፤ በምትኩ 'ብሔራዊ' ኮሚሽንን ትደግፋለች። ዜሁት ያልተገደበ ሥልጣን ያለው 'ገለልተኛ' ኮሚሽን ይፈልጋል።"
      }),
      sources: [src.ynetInquiry]
    },
    {
      id: "pos-likud-inquiry",
      partyId: "likud",
      question: "october-7-inquiry",
      stance: "opposes",
      speaker: kisch,
      summary: L({
        he: "הליכוד לא מסר ל-ynet עמדה רשמית. קיש מתנגד לוועדה שחבריה ייבחרו בידי נשיא העליון יצחק עמית, ומביא כמודל את חקירת פיגועי 11 בספטמבר בארה\"ב.",
        ar: "لم يقدّم الليكود لـ Ynet موقفًا رسميًا. يعارض كيش لجنة يختار أعضاءها رئيس المحكمة العليا يتسحاق عميت، ويستشهد بالتحقيق الأمريكي في هجمات 11 أيلول/سبتمبر نموذجًا.",
        yi: "דער ליכוד האָט ניט געגעבן Ynet קיין אָפֿיציעלע שטעלונג. קיש איז קעגן אַ קאָמיסיע וועמענס מיטגלידער קלײַבט דער פּרעזידענט פֿונעם העכסטן געריכט יצחק עמית, און ברענגט ווי אַ מוסטער די אַמעריקאַנער אויספֿאָרשונג פֿון 11טן סעפּטעמבער.",
        ru: "«Ликуд» не сообщил Ynet официальной позиции. Киш против комиссии, члены которой выбирает председатель Верховного суда Ицхак Амит, и приводит в пример американское расследование терактов 11 сентября.",
        uk: "«Лікуд» не надав Ynet офіційної позиції. Кіш проти комісії, членів якої обирає голова Верховного суду Іцхак Аміт, і наводить як приклад американське розслідування терактів 11 вересня.",
        en: "Likud gave Ynet no official position. Kisch opposes an inquiry whose members would be selected by Supreme Court President Isaac Amit, citing the US 9/11 investigation as a model.",
        am: "ሊኩድ ለYnet ኦፊሴላዊ አቋም አልሰጠም። ኪሽ አባላቱ በጠቅላይ ፍርድ ቤቱ ፕሬዚዳንት ይስሐቅ አሚት የሚመረጡበትን ምርመራ ይቃወማሉ፤ የአሜሪካውን የመስከረም 11 ምርመራ እንደ አርአያ ይጠቅሳሉ።"
      }),
      sources: [src.jpostKisch, src.ynetInquiry]
    },
    {
      id: "pos-amcha-inquiry",
      partyId: "amcha-yisrael",
      question: "october-7-inquiry",
      stance: "opposes",
      speaker: "list",
      summary: L({
        he: "מבקשת ועדה מיד עם הקמת הממשלה הבאה, אך שיו\"ר וסגנו, שופטים בדימוס, ייבחרו בכנסת בהצבעה חשאית ולא ימונו בידי נשיא העליון.",
        ar: "تريد لجنة فور تشكيل الحكومة المقبلة، على أن ينتخب الكنيست رئيسها ونائبه، وهما قاضيان متقاعدان، بتصويت سري بدلًا من تعيينهما من رئيس المحكمة العليا.",
        yi: "וויל אַ קאָמיסיע גלײַך ווען די קומענדיקע רעגירונג ווערט געשאַפֿן, אָבער אַז איר פֿאָרזיצער און זײַן סגן, ביידע שופֿטים אויף פּענסיע, זאָלן געקליבן ווערן אין דער כנסת אין אַ געהיימער אָפּשטימונג, ניט באַשטימט פֿונעם פּרעזידענט פֿונעם העכסטן געריכט.",
        ru: "Хочет комиссию сразу после формирования следующего правительства, но чтобы её председателя и заместителя — судей в отставке — избирал Кнессет тайным голосованием, а не назначал председатель Верховного суда.",
        uk: "Хоче комісію одразу після формування наступного уряду, але щоб її голову й заступника — суддів у відставці — обирав Кнесет таємним голосуванням, а не призначав голова Верховного суду.",
        en: "Wants a commission as soon as the next government forms, but with its chair and deputy, both retired judges, elected by the Knesset in a secret vote rather than appointed by the Supreme Court president.",
        am: "የሚቀጥለው መንግሥት እንደተመሠረተ ኮሚሽን እንዲቋቋም ትፈልጋለች፤ ሆኖም ጡረተኛ ዳኞች የሆኑት ሰብሳቢውና ምክትሉ በጠቅላይ ፍርድ ቤቱ ፕሬዚዳንት ሳይሆን በክኔሴቱ በሚስጥር ድምፅ እንዲመረጡ ትሻለች።"
      }),
      sources: [src.ynetInquiry]
    },
    { id: "pos-shas-inquiry", partyId: "shas", question: "october-7-inquiry", stance: "declined", speaker: "list", summary: declinedInquiry, sources: [src.ynetInquiry] },
    { id: "pos-utj-inquiry", partyId: "utj", question: "october-7-inquiry", stance: "declined", speaker: "list", summary: declinedInquiry, sources: [src.ynetInquiry] },
    { id: "pos-otzma-inquiry", partyId: "otzma-yehudit", question: "october-7-inquiry", stance: "declined", speaker: "list", summary: declinedInquiry, sources: [src.ynetInquiry] },

    // 9 — non-partisan police, army and security services
    {
      id: "pos-yashar-security",
      partyId: "yashar",
      question: "professional-security-services",
      stance: "statement_available",
      speaker: "leader",
      summary: L({
        he: "מינוי איש מקצוע ראוי לשר, תקציבים למשטרה והחזרת שוטרים שעזבו; פרויקט בהובלת ראש השב\"כ לשעבר יורם כהן להחזרת המשטרה לשיטור מקצועי.",
        ar: "تعيين شخص مهني كفء وزيرًا، وتمويل الشرطة وإعادة الأفراد الذين غادروها؛ ومشروع يقوده رئيس الشاباك السابق يورام كوهين لإعادة الشرطة إلى العمل الشرطي المهني.",
        yi: "באַשטימען אַ פּאַסיקן פֿאַכמאַן פֿאַר מיניסטער, געלט פֿאַר דער פּאָליציי און צוריקברענגען פּאָליציסטן וואָס זײַנען אַוועק; אַ פּראָיעקט אונטער דעם געוועזענעם שב\"כ־שעף יורם כהן צוריקצוברענגען די פּאָליציי צו פּראָפֿעסיאָנעלער אַרבעט.",
        ru: "Назначить министром квалифицированного профессионала, увеличить бюджет полиции и вернуть ушедших сотрудников; проект во главе с бывшим главой ШАБАКа Йорамом Коэном по возвращению полиции к профессиональной работе.",
        uk: "Призначити міністром кваліфікованого фахівця, збільшити бюджет поліції та повернути працівників, які пішли; проєкт на чолі з колишнім очільником ШАБАКу Йорамом Коеном щодо повернення поліції до професійної роботи.",
        en: "Appoint a qualified professional as minister, fund the police and bring back officers who left; a project led by former Shin Bet head Yoram Cohen to return the police to professional policing.",
        am: "ብቁ ባለሙያን ሚኒስትር አድርጎ መሾም፣ ለፖሊስ በጀት መመደብ እና የለቀቁ ፖሊሶችን መመለስ፤ ፖሊስን ወደ ሙያዊ ሥራ ለመመለስ በቀድሞው የሺን ቤት ኃላፊ ዮራም ኮኸን የሚመራ ፕሮጀክት።"
      }),
      sources: [src.ynetPolice, src.ynet100Days]
    },
    {
      id: "pos-beyachad-security",
      partyId: "beyachad",
      question: "professional-security-services",
      stance: "statement_available",
      speaker: "leader",
      summary: L({
        he: "הוצאת בן גביר מתפקיד השר והקמה מחדש של קבינט המלחמה בפשיעה. ביולי 2026 כתב בנט שמשרת ציבור שמפר את חובת האמונים ומנצל את תפקידו פוליטית \"יודח באופן מיידי\".",
        ar: "إقالة بن غفير من الوزارة وإعادة تشكيل المجلس الوزاري لمكافحة الجريمة. في تموز/يوليو 2026 كتب بينيت أن أي موظف عام يخلّ بواجب الولاء ويستغل منصبه سياسيًا «سيُقال فورًا».",
        yi: "אַראָפּנעמען בן גביר פֿון זײַן מיניסטער־פּאָסטן און ווידער אויפֿשטעלן דעם קאַבינעט קעגן קרימינאַליטעט. אין יולי 2026 האָט בנט געשריבן אַז אַ ציבור־באַאַמטער וואָס ברעכט זײַן געטרײַשאַפֿט און נוצט זײַן אַמט פּאָליטיש \"וועט גלײַך אָפּגעזאָגט ווערן\".",
        ru: "Снять Бен-Гвира с поста министра и восстановить кабинет по борьбе с преступностью. В июле 2026 года Беннет написал, что госслужащий, нарушивший долг верности и использующий должность в политических целях, «будет немедленно уволен».",
        uk: "Звільнити Бен-Ґвіра з посади міністра й відновити кабінет боротьби зі злочинністю. У липні 2026 року Беннет написав, що державного службовця, який порушить обов’язок вірності й використовуватиме посаду в політичних цілях, «буде негайно звільнено».",
        en: "Remove Ben Gvir as minister and re-establish the cabinet against crime. In July 2026 Bennett wrote that any public servant who breaches the duty of loyalty and uses the role politically 'will be dismissed immediately'.",
        am: "ቤን ግቪርን ከሚኒስትርነት ማንሳት እና የወንጀል መከላከያ ካቢኔን እንደገና ማቋቋም። በሐምሌ 2026 ቤኔት የታማኝነት ግዴታውን የጣሰና ሥልጣኑን ለፖለቲካ የተጠቀመ የሕዝብ አገልጋይ 'ወዲያውኑ ይባረራል' ሲል ጽፏል።"
      }),
      sources: [src.ynetPolice, src.haaretzZini]
    },
    {
      id: "pos-yb-security",
      partyId: "yisrael-beiteinu",
      question: "professional-security-services",
      stance: "statement_available",
      speaker: "leader",
      summary: L({
        he: "מטה ביטחון לאומי שיכלול את השב\"כ, רשות המסים והפרקליטות; מציע את ח\"כ חמד עמאר לתיק ביטחון הפנים.",
        ar: "مقرّ للأمن القومي يضم الشاباك وسلطة الضرائب والنيابة العامة؛ ويرشّح النائب حمد عمار لحقيبة الأمن الداخلي.",
        yi: "אַ הויפּטקוואַרטיר פֿאַר נאַציאָנאַלער זיכערהייט מיטן שב\"כ, דער שטײַער־אויטאָריטעט און דער פּרקליטות; שלאָגט פֿאָר ח\"כ חמד עמאר פֿאַרן פּאָרטפֿעל פֿון אינערלעכער זיכערהייט.",
        ru: "Штаб национальной безопасности с участием ШАБАКа, Налогового управления и прокуратуры; на пост министра внутренней безопасности предлагает депутата Хамада Амара.",
        uk: "Штаб національної безпеки за участю ШАБАКу, Податкового управління та прокуратури; на посаду міністра внутрішньої безпеки пропонує депутата Хамада Амара.",
        en: "A national security HQ that includes the Shin Bet, the Tax Authority and the prosecution; names MK Hamad Amar for the internal security portfolio.",
        am: "የሺን ቤትን፣ የግብር ባለሥልጣንንና ዐቃቤ ሕግን ያካተተ የብሔራዊ ደህንነት ዋና መሥሪያ ቤት፤ ለውስጥ ደህንነት ሚኒስቴር የክኔሴት አባል ሐማድ ዐማርን ያቀርባል።"
      }),
      sources: [src.ynetPolice, src.beytenuPlatform]
    },
    {
      id: "pos-dem-security",
      partyId: "the-democrats",
      question: "professional-security-services",
      stance: "statement_available",
      speaker: "list",
      summary: L({
        he: "מתחייבת ל\"משטרה מקצועית שמשרתת את הציבור\"; באתרה מופיע פריט קמפיין על סוף המינויים הפוליטיים.",
        ar: "تتعهد بـ«شرطة مهنية تخدم الجمهور»؛ ويعرض موقعها مادة حملة عن إنهاء التعيينات السياسية.",
        yi: "זאָגט צו \"אַ פּראָפֿעסיאָנעלע פּאָליציי וואָס דינט דעם עולם\"; אויף איר זײַטל איז דאָ אַ קאַמפּײַן־פּונקט וועגן אַן עק צו פּאָליטישע באַשטימונגען.",
        ru: "Обещает «профессиональную полицию, служащую обществу»; на её сайте есть агитационный материал о конце политических назначений.",
        uk: "Обіцяє «професійну поліцію, що служить суспільству»; на її сайті є агітаційний матеріал про кінець політичних призначень.",
        en: "Pledges 'a professional police that serves the public'; its site features a campaign item on ending political appointments.",
        am: "'ሕዝብን የሚያገለግል ሙያዊ ፖሊስ' ለማረጋገጥ ቃል ገብቷል፤ በድረ ገጹ ላይ የፖለቲካ ሹመቶችን ስለማቆም የዘመቻ ጽሑፍ አለ።"
      }),
      sources: [src.democratsSite]
    },
    {
      id: "pos-utj-security",
      partyId: "utj",
      question: "professional-security-services",
      stance: "statement_available",
      speaker: "leader",
      summary: L({
        he: "להשאיר את המשטרה \"כמה שפחות פוליטית\" ולתת גיבוי לשוטרים.",
        ar: "إبقاء الشرطة «بعيدة عن السياسة قدر الإمكان» ودعم أفرادها.",
        yi: "האַלטן די פּאָליציי \"וואָס ווייניקער פּאָליטיש\" און געבן שטיצע די פּאָליציסטן.",
        ru: "Сделать полицию «как можно менее политической» и поддерживать полицейских.",
        uk: "Зробити поліцію «якомога менш політичною» й підтримувати поліцейських.",
        en: "Keep the police 'as unpolitical as possible' and give officers backing.",
        am: "ፖሊስን 'በተቻለ መጠን ከፖለቲካ የራቀ' ማድረግ እና ለፖሊሶች ድጋፍ መስጠት።"
      }),
      sources: [src.ynetPolice]
    },

    {
      id: "pos-noam-security",
      partyId: "noam",
      question: "professional-security-services",
      stance: "statement_available",
      speaker: "list",
      summary: L({
        he: "מבקשת לשנות את אופן מינוי השופטים והבכירים כך שלנבחרי הציבור יהיה משקל מכריע במינויים.",
        ar: "تريد تغيير طريقة تعيين القضاة وكبار المسؤولين بحيث يكون للمنتخَبين وزن حاسم في التعيينات.",
        yi: "וויל ענדערן ווי מע באַשטימט ריכטער און הויכע באַאַמטע, אַזוי אַז די געוויילטע זאָלן האָבן אַן אויספֿירנדיקע וואָג אין די באַשטימונגען.",
        ru: "Хочет изменить порядок назначения судей и высокопоставленных чиновников, чтобы решающий вес в назначениях был у избранных политиков.",
        uk: "Хоче змінити порядок призначення суддів і високопосадовців, щоб вирішальна вага в призначеннях була в обраних політиків.",
        en: "Wants to change how judges and senior officials are appointed so that elected officials have the decisive weight.",
        am: "የዳኞችና የከፍተኛ ባለሥልጣናት አሿሿም እንዲቀየርና በሹመቶች ውስጥ ወሳኙ ክብደት ለተመረጡ ባለሥልጣናት እንዲሆን ትፈልጋለች።"
      }),
      sources: [src.kikarNoam]
    },

    // 10 — publishing coalition and budget commitments
    {
      id: "pos-israelfirst-budget",
      partyId: "israel-first",
      question: "public-agreements",
      stance: "supports_with_reservations",
      speaker: "list",
      summary: L({
        he: "תוכנית העבודה (ספטמבר 2026): הצגת התמונה המלאה של תקציבים, תמיכות והעברות מגזריות, ישירות ועקיפות. הסכמים קואליציוניים אינם מוזכרים.",
        ar: "خطة العمل (أيلول/سبتمبر 2026): عرض الصورة الكاملة للميزانيات والدعم والتحويلات القطاعية المباشرة وغير المباشرة. لا تُذكر الاتفاقيات الائتلافية.",
        yi: "דער אַרבעטס־פּלאַן (סעפּטעמבער 2026): ווײַזן דאָס פֿולע בילד פֿון בודזשעטן, שטיצע און סעקטאָראַלע טראַנספֿערן, דירעקט און אומדירעקט. קאָאַליציע־אָפּמאַכן ווערן ניט דערמאָנט.",
        ru: "План работы (сентябрь 2026): раскрыть полную картину бюджетов, субсидий и секторальных переводов, прямых и косвенных. Коалиционные соглашения не упоминаются.",
        uk: "План роботи (вересень 2026): розкрити повну картину бюджетів, субсидій і секторальних переказів, прямих і непрямих. Коаліційні угоди не згадуються.",
        en: "Work plan (September 2026): show the full picture of budgets, support and sectoral transfers, direct and indirect. Coalition agreements are not mentioned.",
        am: "የሥራ ዕቅዱ (መስከረም 2026)፦ የበጀቶችን፣ የድጎማዎችንና የዘርፍ ዝውውሮችን ቀጥተኛና ቀጥተኛ ያልሆነ ሙሉ ገጽታ ማሳየት። የጥምረት ስምምነቶች አልተጠቀሱም።"
      }),
      sources: [src.israelFirstPlan]
    }
  ],

  other: [
    {
      id: "oth-likud-draft",
      partyId: "likud",
      speaker: "leader",
      summary: L({
        he: "ימשיך לקדם את חוק הפטור מגיוס בקדנציה הבאה; לא התחייב להעבירו לפני הקמת הממשלה.",
        ar: "سيواصل الدفع بقانون الإعفاء من التجنيد في الولاية المقبلة؛ لم يلتزم بإقراره قبل تشكيل الحكومة.",
        yi: "וועט ווײַטער פֿאָרטרײַבן דאָס געזעץ פֿון באַפֿרײַונג פֿון גיוס אין דער קומענדיקער קאַדענץ; האָט זיך ניט מתחייב געווען עס דורכצופֿירן פֿאַר דער רעגירונג ווערט געשאַפֿן.",
        ru: "Продолжит продвигать закон об освобождении от призыва в следующей каденции; не обязался принять его до формирования правительства.",
        uk: "Далі просуватиме закон про звільнення від призову в наступній каденції; не зобов’язався ухвалити його до формування уряду.",
        en: "Will keep advancing the draft-exemption law in the next term; did not commit to passing it before a government is formed.",
        am: "በሚቀጥለው የሥልጣን ዘመን ከምልመላ ነፃ የማድረግ ሕጉን ማራመዱን ይቀጥላል፤ መንግሥት ከመመሥረቱ በፊት ለማጽደቅ ቃል አልገባም።"
      }),
      sources: [src.makoNetanyahu]
    },
    {
      id: "oth-likud-judiciary",
      partyId: "likud",
      speaker: "list",
      summary: L({
        he: "תומכת בפיצול תפקיד היועמ\"ש, בפסקת התגברות ברוב של 61 ובשינוי הרכב הוועדה לבחירת שופטים.",
        ar: "تؤيد فصل منصب المستشار القضائي للحكومة، وفقرة التغلب بأغلبية 61، وتغيير تركيبة لجنة اختيار القضاة.",
        yi: "שטיצט צעטיילן דעם יועמ\"ש־אַמט, אַ פּסקת התגברות מיט 61 ח\"כים, און ענדערן די קאָמיסיע צו קלײַבן ריכטער.",
        ru: "Поддерживает разделение должности юридического советника правительства, «преодолевающую оговорку» большинством в 61 депутат и изменение комиссии по выбору судей.",
        uk: "Підтримує розділення посади юридичного радника уряду, «положення про подолання» більшістю в 61 депутата та зміну комісії з добору суддів.",
        en: "Supports splitting the attorney general's role, an override clause by 61 MKs and changing the judicial selection committee.",
        am: "የጠቅላይ ዐቃቤ ሕጉን ሚና መከፋፈልን፣ በ61 የክኔሴት አባላት የሚጸድቅ የመሻሪያ አንቀጽን እና የዳኞች መራጭ ኮሚቴን መቀየርን ይደግፋል።"
      }),
      sources: [src.makoJudiciary]
    },
    {
      id: "oth-beyachad-term",
      partyId: "beyachad",
      speaker: "list",
      summary: L({
        he: "הגבלת כהונת ראש הממשלה לשמונה שנים, החל מבנט עצמו; כינון חוקה על בסיס עקרונות מגילת העצמאות.",
        ar: "تحديد ولاية رئيس الحكومة بثماني سنوات بدءًا ببينيت نفسه؛ وصياغة دستور على أساس مبادئ وثيقة الاستقلال.",
        yi: "באַגרענעצן די קאַדענץ פֿונעם פּרעמיער אויף אַכט יאָר, אָנגעהויבן פֿון בנט אַליין; שאַפֿן אַ קאָנסטיטוציע אויף די פּרינציפּן פֿון מגילת העצמאות.",
        ru: "Ограничить срок премьер-министра восемью годами, начиная с самого Беннета; принять конституцию на принципах Декларации независимости.",
        uk: "Обмежити строк прем’єр-міністра вісьмома роками, починаючи із самого Беннета; ухвалити конституцію на засадах Декларації незалежності.",
        en: "Limit the prime minister's tenure to eight years, starting with Bennett himself; draft a constitution on the principles of the Declaration of Independence.",
        am: "የጠቅላይ ሚኒስትሩን የሥልጣን ዘመን ከራሱ ከቤኔት ጀምሮ በስምንት ዓመት መገደብ፤ በነፃነት አዋጁ መርሆዎች ላይ የተመሠረተ ሕገ መንግሥት ማውጣት።"
      }),
      sources: [src.beyahadPlans, src.makoBennett]
    },
    {
      id: "oth-beyachad-service",
      partyId: "beyachad",
      speaker: "leader",
      summary: L({
        he: "חוק \"שירות לכולם\" והפסקת מימון ההשתמטות, \"אף לא שקל\".",
        ar: "قانون «الخدمة للجميع» ووقف تمويل التهرب من التجنيد «ولا شيكل واحد».",
        yi: "אַ \"דינסט פֿאַר אַלעמען\"־געזעץ און אַן עק צו פֿינאַנצירן אויסמײַדן דעם גיוס, \"ניט קיין איין שקל\".",
        ru: "Закон «служба для всех» и прекращение финансирования уклонения от призыва — «ни одного шекеля».",
        uk: "Закон «служба для всіх» і припинення фінансування ухилення від призову — «жодного шекеля».",
        en: "A 'service for all' law and an end to funding draft evasion, 'not one shekel'.",
        am: "'አገልግሎት ለሁሉም' ሕግ እና ከምልመላ መሸሽን በገንዘብ መደገፍ ማቆም፣ 'አንድ ሼቄልም ቢሆን'።"
      }),
      sources: [src.makoBennett]
    },
    {
      id: "oth-beyachad-selection",
      partyId: "beyachad",
      speaker: "list",
      summary: L({
        he: "ביטול החוק החדש לבחירת שופטים וקביעה בחוק יסוד: החקיקה מתי בית המשפט יכול להתערב.",
        ar: "إلغاء القانون الجديد لاختيار القضاة، وتحديد متى يجوز للمحكمة التدخل في قانون أساس: التشريع.",
        yi: "אָפּשאַפֿן דאָס נײַע געזעץ צו קלײַבן ריכטער און באַשטימען אין אַ חוק יסוד: החקיקה ווען דאָס געריכט מעג זיך אַרײַנמישן.",
        ru: "Отменить новый закон о выборе судей и закрепить в Основном законе о законодательстве, когда суд может вмешиваться.",
        uk: "Скасувати новий закон про добір суддів і закріпити в Основному законі про законодавство, коли суд може втручатися.",
        en: "Repeal the new judicial selection law and set out in a Basic Law: Legislation when courts may intervene.",
        am: "አዲሱን የዳኞች አመራረጥ ሕግ መሻር እና ፍርድ ቤት መቼ ጣልቃ ሊገባ እንደሚችል በመሠረታዊ ሕግ፦ ሕግ ማውጣት ውስጥ መደንገግ።"
      }),
      sources: [src.ynetJudiciary]
    },
    {
      id: "oth-yashar-repeal",
      partyId: "yashar",
      speaker: "list",
      summary: L({
        he: "ביטול מיידי של חוק הוועדה לבחירת שופטים, של הכפפת מח\"ש לדרג הפוליטי, של חוק היועמ\"ש ושל חוק התקשורת.",
        ar: "الإلغاء الفوري لقانون لجنة اختيار القضاة، وإخضاع قسم التحقيق مع أفراد الشرطة للمستوى السياسي، وقانون المستشار القضائي، وقانون الاتصالات.",
        yi: "גלײַך אָפּשאַפֿן דאָס געזעץ פֿון דער קאָמיסיע צו קלײַבן ריכטער, דאָס אונטערוואַרפֿן פֿון מח\"ש דעם פּאָליטישן דרג, דאָס יועמ\"ש־געזעץ און דאָס קאָמוניקאַציע־געזעץ.",
        ru: "Немедленно отменить закон о комиссии по выбору судей, подчинение отдела расследований против полицейских (Махаш) политическому уровню, закон о юрсоветнике и закон о СМИ.",
        uk: "Негайно скасувати закон про комісію з добору суддів, підпорядкування відділу розслідувань щодо поліцейських (Махаш) політичному рівню, закон про юрдорадника та закон про медіа.",
        en: "Repeal at once the judicial selection committee law, the placing of police-misconduct investigations (Mahash) under political control, the attorney general law and the communications law.",
        am: "የዳኞች መራጭ ኮሚቴ ሕግን፣ የፖሊስ ምርመራ ክፍልን (ማሃሽ) ለፖለቲካ አመራር ማስገዛትን፣ የጠቅላይ ዐቃቤ ሕጉን ሕግ እና የመገናኛ ሕጉን ወዲያውኑ መሻር።"
      }),
      sources: [src.ynet100Days]
    },
    {
      id: "oth-yashar-service",
      partyId: "yashar",
      speaker: "list",
      summary: L({
        he: "שירות צבאי או לאומי לכולם עם סנקציות על משתמטים, וביטול מימון לחינוך עצמאי שאינו מלמד ליבה.",
        ar: "خدمة عسكرية أو وطنية للجميع مع عقوبات على المتهربين، ووقف تمويل التعليم المستقل الذي لا يدرّس المنهاج الأساسي.",
        yi: "מיליטערישע אָדער נאַציאָנאַלע דינסט פֿאַר אַלעמען מיט סאַנקציעס אויף אויסמײַדער, און קיין געלט פֿאַר אומאָפּהענגיקן חינוך וואָס לערנט ניט קיין ליבה.",
        ru: "Военная или национальная служба для всех с санкциями против уклонистов и прекращение финансирования независимого образования без базовой программы.",
        uk: "Військова або національна служба для всіх із санкціями проти ухилянтів і припинення фінансування незалежної освіти без базової програми.",
        en: "Military or national service for everyone with sanctions on evaders, and no funding for independent schools that skip the core curriculum.",
        am: "ለሁሉም ወታደራዊ ወይም ብሔራዊ አገልግሎት ከሸሾች ላይ ማዕቀብ ጋር፣ እና መሠረታዊ ሥርዓተ ትምህርትን ለማያስተምር ገለልተኛ ትምህርት የሚሰጥ ገንዘብን ማቆም።"
      }),
      sources: [src.ynet100Days]
    },
    {
      id: "oth-yashar-term",
      partyId: "yashar",
      speaker: "list",
      summary: L({
        he: "חקיקת קציבת כהונת ראש הממשלה וכללי נבצרות של ראש הממשלה.",
        ar: "تشريع تحديد ولاية رئيس الحكومة وقواعد إعلان عجزه عن القيام بمهامه.",
        yi: "אַ געזעץ צו באַגרענעצן די קאַדענץ פֿונעם פּרעמיער און כּללים ווען אַ פּרעמיער ווערט דערקלערט אומפֿעיִק.",
        ru: "Принять закон об ограничении срока премьер-министра и правила признания премьера недееспособным.",
        uk: "Ухвалити закон про обмеження строку прем’єр-міністра та правила визнання прем’єра недієздатним.",
        en: "Legislate a limit on the prime minister's tenure and rules for declaring a prime minister incapacitated.",
        am: "የጠቅላይ ሚኒስትሩን የሥልጣን ዘመን የሚገድብ ሕግ እና ጠቅላይ ሚኒስትሩ ማገልገል የማይችልበትን ሁኔታ የሚወስኑ ደንቦችን ማውጣት።"
      }),
      sources: [src.ynet100Days]
    },
    {
      id: "oth-yb-constitution",
      partyId: "yisrael-beiteinu",
      speaker: "list",
      summary: L({
        he: "כינון חוקה והקמת בית משפט לחוקה; התנגדות לפסקת ההתגברות ול\"חוק הצרפתי\".",
        ar: "دستور مكتوب ومحكمة دستورية؛ معارضة فقرة التغلب و«القانون الفرنسي».",
        yi: "אַ געשריבענע קאָנסטיטוציע און אַ קאָנסטיטוציאָנעל געריכט; קעגן אַ פּסקת התגברות און דעם \"פֿראַנצויזישן געזעץ\".",
        ru: "Писаная конституция и конституционный суд; против «преодолевающей оговорки» и «французского закона».",
        uk: "Писана конституція та конституційний суд; проти «положення про подолання» і «французького закону».",
        en: "A written constitution and a constitutional court; opposes an override clause and the 'French law'.",
        am: "የተጻፈ ሕገ መንግሥት እና ሕገ መንግሥታዊ ፍርድ ቤት፤ የመሻሪያ አንቀጽን እና 'የፈረንሳይን ሕግ' ይቃወማል።"
      }),
      sources: [src.beytenuPlatform]
    },
    {
      id: "oth-yb-terms",
      partyId: "yisrael-beiteinu",
      speaker: "list",
      summary: L({
        he: "הגבלת כהונת ראש הממשלה לשתי קדנציות; בשנתיים הראשונות ניתן יהיה להפיל ממשלה רק ברוב של 90 ח\"כים.",
        ar: "تحديد ولاية رئيس الحكومة بدورتين؛ وفي أول عامين لا تُسقَط الحكومة إلا بأغلبية 90 نائبًا.",
        yi: "באַגרענעצן דעם פּרעמיער אויף צוויי קאַדענצן; אין די ערשטע צוויי יאָר זאָל מען קענען אַראָפּוואַרפֿן אַ רעגירונג נאָר מיט 90 ח\"כים.",
        ru: "Ограничить премьер-министра двумя каденциями; в первые два года правительство можно будет свалить только большинством в 90 депутатов.",
        uk: "Обмежити прем’єр-міністра двома каденціями; у перші два роки уряд можна буде скинути лише більшістю в 90 депутатів.",
        en: "Limit the prime minister to two terms; in a government's first two years, only 90 MKs could bring it down.",
        am: "ጠቅላይ ሚኒስትሩን በሁለት የሥልጣን ዘመን መገደብ፤ በመንግሥቱ የመጀመሪያ ሁለት ዓመታት በ90 የክኔሴት አባላት ብቻ ሊወድቅ ይችላል።"
      }),
      sources: [src.beytenuPlatform]
    },
    {
      id: "oth-yb-assets",
      partyId: "yisrael-beiteinu",
      speaker: "list",
      summary: L({
        he: "חובת פרסום פומבי של הצהרות ההון של ראש הממשלה, השרים וכל ראשי המפלגות.",
        ar: "إلزام بنشر إقرارات الذمة المالية لرئيس الحكومة والوزراء وجميع رؤساء الأحزاب علنًا.",
        yi: "אַ פֿליכט צו פֿאַרעפֿנטלעכן די פֿאַרמעגן־דעקלאַראַציעס פֿונעם פּרעמיער, די מיניסטאָרן און אַלע פּאַרטיי־פֿירער.",
        ru: "Обязательная публикация деклараций об имуществе премьер-министра, министров и всех лидеров партий.",
        uk: "Обов’язкове оприлюднення декларацій про майно прем’єр-міністра, міністрів і всіх лідерів партій.",
        en: "Mandatory public asset declarations for the prime minister, ministers and all party leaders.",
        am: "የጠቅላይ ሚኒስትሩ፣ የሚኒስትሮቹ እና የሁሉም ፓርቲ መሪዎች የሀብት ማስታወቂያ በይፋ እንዲታተም ማስገደድ።"
      }),
      sources: [src.beytenuPlatform]
    },
    {
      id: "oth-dem-repeal",
      partyId: "the-democrats",
      speaker: "list",
      summary: L({
        he: "ביטול חוקי המהפכה המשפטית, כולל שינוי הרכב הוועדה לבחירת שופטים, ועיגון בחוק של מעמדן המחייב של חוות דעת היועמ\"ש.",
        ar: "إلغاء قوانين الانقلاب القضائي، بما فيها تغيير تركيبة لجنة اختيار القضاة، وتكريس الصفة الملزمة لآراء المستشار القضائي بالقانون.",
        yi: "אָפּשאַפֿן די געזעצן פֿון דער משפּטישער רעוואָלוציע, אַרײַנגערעכנט די ענדערונג פֿון דער קאָמיסיע צו קלײַבן ריכטער, און פֿאַרזיכערן אין געזעץ דעם בינדנדיקן סטאַטוס פֿון די מיינונגען פֿונעם יועמ\"ש.",
        ru: "Отменить законы судебной реформы, включая изменение комиссии по выбору судей, и закрепить в законе обязательность заключений юридического советника.",
        uk: "Скасувати закони судової реформи, зокрема зміну комісії з добору суддів, і закріпити в законі обов’язковість висновків юридичного радника.",
        en: "Repeal the judicial overhaul laws, including the change to the judicial selection committee, and protect in law the binding status of the attorney general's opinions.",
        am: "የፍትሕ ለውጥ ሕጎችን፣ የዳኞች መራጭ ኮሚቴ ለውጥን ጨምሮ መሻር፣ እና የጠቅላይ ዐቃቤ ሕጉ አስተያየቶች አስገዳጅነትን በሕግ ማጽናት።"
      }),
      sources: [src.makoJudiciary]
    },
    {
      id: "oth-dem-majority",
      partyId: "the-democrats",
      speaker: "list",
      summary: L({
        he: "דרישת רוב מיוחד לשינוי כללי הדמוקרטיה, וחוק יסוד: החקיקה שיגן על עצמאות מערכת המשפט.",
        ar: "اشتراط أغلبية خاصة لتغيير قواعد الديمقراطية، وقانون أساس: التشريع لحماية استقلال القضاء.",
        yi: "פֿאָדערן אַ ספּעציעלע מערהייט צו ענדערן די כּללים פֿון דער דעמאָקראַטיע, און אַ חוק יסוד: החקיקה צו באַשיצן די אומאָפּהענגיקייט פֿון די געריכטן.",
        ru: "Требовать особого большинства для изменения правил демократии и принять Основной закон о законодательстве, защищающий независимость судов.",
        uk: "Вимагати особливої більшості для зміни правил демократії та ухвалити Основний закон про законодавство, що захищає незалежність судів.",
        en: "Require a special majority to change the rules of democracy, and pass a Basic Law: Legislation protecting judicial independence.",
        am: "የዴሞክራሲን ደንቦች ለመቀየር ልዩ አብላጫ ድምፅ መጠየቅ፣ እና የፍርድ ቤቶችን ነፃነት የሚጠብቅ መሠረታዊ ሕግ፦ ሕግ ማውጣትን ማጽደቅ።"
      }),
      sources: [src.ynetJudiciary]
    },
    {
      id: "oth-shas-judiciary",
      partyId: "shas",
      speaker: "list",
      summary: L({
        he: "תומכת בפסקת התגברות ותמכה בהצעת החוק מ-2025 לפיצול תפקיד היועמ\"ש.",
        ar: "تؤيد فقرة التغلب، ودعمت مشروع قانون 2025 لفصل منصب المستشار القضائي.",
        yi: "שטיצט אַ פּסקת התגברות און האָט געשטיצט דעם 2025 געזעץ־פֿאָרשלאָג צו צעטיילן דעם יועמ\"ש־אַמט.",
        ru: "Поддерживает «преодолевающую оговорку» и поддержала законопроект 2025 года о разделении должности юрсоветника.",
        uk: "Підтримує «положення про подолання» та підтримала законопроєкт 2025 року про розділення посади юрдорадника.",
        en: "Supports an override clause, and backed the 2025 bill to split the attorney general's role.",
        am: "የመሻሪያ አንቀጽን ትደግፋለች፤ የጠቅላይ ዐቃቤ ሕጉን ሚና ለመከፋፈል የቀረበውን የ2025 ረቂቅ ሕግም ደግፋለች።"
      }),
      sources: [src.makoJudiciary]
    },
    {
      id: "oth-rz-justice",
      partyId: "religious-zionism",
      speaker: "list",
      summary: L({
        he: "\"משפט וצדק 2.0\": פסקת התגברות, פיצול תפקיד היועמ\"ש והפיכתו למשרת אמון של הממשלה; מוצג כתנאי לכניסה לכל קואליציה.",
        ar: "«القانون والعدالة 2.0»: فقرة تغلب، وفصل منصب المستشار القضائي وجعله منصب ثقة للحكومة؛ مقدَّم شرطًا للانضمام إلى أي ائتلاف.",
        yi: "\"משפט וצדק 2.0\": אַ פּסקת התגברות, צעטיילן דעם יועמ\"ש־אַמט און מאַכן אים אַ משרת אמון פֿון דער רעגירונג; פֿאָרגעשטעלט ווי אַ תּנאַי זיך אָנצושליסן צו סיי וועלכער קאָאַליציע.",
        ru: "«Закон и правосудие 2.0»: «преодолевающая оговорка», разделение должности юрсоветника и превращение её в должность доверия правительства; подаётся как условие вхождения в любую коалицию.",
        uk: "«Закон і правосуддя 2.0»: «положення про подолання», розділення посади юрдорадника та перетворення її на посаду довіри уряду; подається як умова входження до будь-якої коаліції.",
        en: "'Law and Justice 2.0': an override clause, and splitting the attorney general's role into a position of government trust; presented as a condition for joining any coalition.",
        am: "'ሕግ እና ፍትሕ 2.0'፦ የመሻሪያ አንቀጽ፣ የጠቅላይ ዐቃቤ ሕጉን ሚና መከፋፈልና የመንግሥት የእምነት ሹመት ማድረግ፤ ማንኛውንም ጥምረት ለመቀላቀል ቅድመ ሁኔታ ሆኖ ቀርቧል።"
      }),
      sources: [src.ynetJudiciary]
    },
    {
      id: "oth-rz-zehut",
      partyId: "religious-zionism",
      speaker: "list",
      summary: L({
        he: "זהות: ביטול הוועדה לבחירת שופטים ובחירה ישירה של שופטי העליון בידי הציבור.",
        ar: "زهوت: إلغاء لجنة اختيار القضاة وانتخاب قضاة المحكمة العليا مباشرة من الجمهور.",
        yi: "זהות: אָפּשאַפֿן די קאָמיסיע צו קלײַבן ריכטער, און דער עולם זאָל דירעקט קלײַבן די שופֿטים פֿונעם העכסטן געריכט.",
        ru: "«Зеут»: упразднить комиссию по выбору судей и избирать судей Верховного суда прямым голосованием.",
        uk: "«Зеут»: скасувати комісію з добору суддів і обирати суддів Верховного суду прямим голосуванням.",
        en: "Zehut: abolish the judicial selection committee and have voters elect Supreme Court justices directly.",
        am: "ዜሁት፦ የዳኞች መራጭ ኮሚቴን ማስቀረት እና የጠቅላይ ፍርድ ቤት ዳኞችን መራጮች በቀጥታ እንዲመርጡ ማድረግ።"
      }),
      sources: [src.ynetJudiciary]
    },
    {
      id: "oth-otzma-ag",
      partyId: "otzma-yehudit",
      speaker: "list",
      summary: L({
        he: "פיטורי היועמ\"שית מיד, כצעד ראשון של הממשלה הבאה.",
        ar: "إقالة المستشارة القضائية فورًا، كأول خطوة للحكومة المقبلة.",
        yi: "אָפּזאָגן די יועמ\"שית גלײַך, ווי דער ערשטער שריט פֿון דער קומענדיקער רעגירונג.",
        ru: "Немедленно уволить юридического советника правительства — первым шагом следующего правительства.",
        uk: "Негайно звільнити юридичну радницю уряду — першим кроком наступного уряду.",
        en: "Dismiss the attorney general immediately, as the next government's first step.",
        am: "የሚቀጥለው መንግሥት የመጀመሪያ እርምጃ አድርጎ ጠቅላይ ዐቃቤ ሕጓን ወዲያውኑ ማሰናበት።"
      }),
      sources: [src.makoJudiciary]
    },
    {
      id: "oth-amcha-courts",
      partyId: "amcha-yisrael",
      speaker: "list",
      summary: L({
        he: "צמצום עילת הסבירות, הוספת ערכאה שיפוטית ויציאת נציגי לשכת עורכי הדין מהוועדה לבחירת שופטים.",
        ar: "تضييق ذريعة المعقولية، وإضافة درجة قضائية أخرى، وإخراج ممثلي نقابة المحامين من لجنة اختيار القضاة.",
        yi: "פֿאַרענגערן די עילת הסבירות, צולייגן נאָך אַ געריכט־אינסטאַנץ און אַרויסנעמען די פֿאָרשטייער פֿון דער אַדוואָקאַטן־קאַמער פֿון דער קאָמיסיע צו קלײַבן ריכטער.",
        ru: "Сузить критерий разумности, добавить ещё одну судебную инстанцию и вывести представителей Коллегии адвокатов из комиссии по выбору судей.",
        uk: "Звузити критерій розумності, додати ще одну судову інстанцію та вивести представників Колегії адвокатів із комісії з добору суддів.",
        en: "Narrow the reasonableness ground, add another court tier and remove Bar Association members from the judicial selection committee.",
        am: "የምክንያታዊነት መሥፈርትን ማጥበብ፣ ተጨማሪ የፍርድ ቤት እርከን ማከል እና የጠበቆች ማኅበር ተወካዮችን ከዳኞች መራጭ ኮሚቴ ማስወጣት።"
      }),
      sources: [src.ynetJudiciary]
    },
    {
      id: "oth-reservists-draft",
      partyId: "reservists-economy",
      speaker: "leader",
      summary: L({
        he: "גיוס לכולם כתנאי להקמת ממשלה, לצד העלאת שכר החיילים והטבות הקשורות לשירות.",
        ar: "التجنيد للجميع شرطًا لتشكيل الحكومة، مع رفع رواتب الجنود ومزايا مرتبطة بالخدمة.",
        yi: "גיוס פֿאַר אַלעמען ווי אַ תּנאַי צו שאַפֿן אַ רעגירונג, מיט העכערע געהאַלטן פֿאַר סאָלדאַטן און בענעפֿיטן פֿאַרבונדן מיט דינסט.",
        ru: "Всеобщий призыв как условие формирования правительства, повышение выплат солдатам и льготы, привязанные к службе.",
        uk: "Загальний призов як умова формування уряду, підвищення виплат солдатам і пільги, прив’язані до служби.",
        en: "Universal conscription as a condition for forming a government, with higher pay for soldiers and benefits tied to service.",
        am: "ለሁሉም ምልመላ መንግሥት ለመመሥረት ቅድመ ሁኔታ፣ የወታደሮች ክፍያ መጨመር እና ከአገልግሎት ጋር የተያያዙ ጥቅሞች።"
      }),
      sources: [src.zmanHendel]
    },
    {
      id: "oth-reservists-override",
      partyId: "reservists-economy",
      speaker: "list",
      summary: L({
        he: "התגברות על פסילת חוק בידי בג\"ץ רק ברוב של יותר מ-72 ח\"כים; צמצום עילת הסבירות אך לא ביטולה.",
        ar: "السماح بالتغلب على حكم للمحكمة العليا يُبطل قانونًا بأكثر من 72 نائبًا فقط؛ تضييق ذريعة المعقولية دون إلغائها.",
        yi: "דערלויבן איבערגיין אַ בג\"ץ־פּסק וואָס פּסלט אַ געזעץ נאָר מיט מער ווי 72 ח\"כים; פֿאַרענגערן די עילת הסבירות, נאָר ניט אָפּשאַפֿן.",
        ru: "Разрешить преодоление отмены закона БАГАЦем только большинством более 72 депутатов; сузить, но сохранить критерий разумности.",
        uk: "Дозволити подолання скасування закону Багацом лише більшістю понад 72 депутати; звузити, але зберегти критерій розумності.",
        en: "Allow overriding a High Court ruling that strikes down a law only with more than 72 MKs; narrow the reasonableness ground but keep it.",
        am: "ከፍተኛው ፍርድ ቤት ሕግን የሻረበትን ውሳኔ መሻር ከ72 በላይ የክኔሴት አባላት ሲኖሩ ብቻ፤ የምክንያታዊነት መሥፈርትን ማጥበብ እንጂ ማስቀረት አይደለም።"
      }),
      sources: [src.ynetJudiciary]
    },
    {
      id: "oth-noam-ag",
      partyId: "noam",
      speaker: "list",
      summary: L({
        he: "פיצול תפקיד היועמ\"ש וצמצומו.",
        ar: "فصل منصب المستشار القضائي للحكومة وتقليصه.",
        yi: "צעטיילן און פֿאַרקלענערן דעם יועמ\"ש־אַמט.",
        ru: "Разделить и сузить должность юридического советника правительства.",
        uk: "Розділити й звузити посаду юридичного радника уряду.",
        en: "Split the attorney general's role and narrow it.",
        am: "የጠቅላይ ዐቃቤ ሕጉን ሚና መከፋፈልና ማጥበብ።"
      }),
      sources: [src.kikarNoam]
    },
  ]
};

assertPositionsDataset(positions2026);
