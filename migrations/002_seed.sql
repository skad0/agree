INSERT INTO campaigns (id, slug, status) VALUES (1, 'civic-request', 'active');
INSERT INTO demands (id, campaign_id, sort_order) VALUES (1, 1, 1);

INSERT INTO demand_translations (demand_id, locale, title, body) VALUES
  (1, 'en', 'Transparent public institutions', 'Explain decisions in plain language and publish measurable follow-up.'),
  (1, 'he', 'מוסדות ציבור שקופים', 'יש להסביר החלטות בשפה ברורה ולפרסם מעקב מדיד.'),
  (1, 'ar', 'مؤسسات عامة شفافة', 'اشرحوا القرارات بلغة واضحة وانشروا متابعة قابلة للقياس.'),
  (1, 'yi', 'דורכזיכטיקע עפֿנטלעכע אינסטיטוציעס', 'דערקלערט באַשלוסן אויף אַ קלאָרער שפּראַך און פֿאַרעפֿנטלעכט מעסטלעכע נאָכפֿאָלגונג.'),
  (1, 'ru', 'Прозрачные общественные институты', 'Объясняйте решения понятным языком и публикуйте измеримые результаты.'),
  (1, 'am', 'ግልጽ የሕዝብ ተቋማት', 'ውሳኔዎችን በግልጽ ቋንቋ ያብራሩ እና ሊለካ የሚችል ክትትል ያትሙ።');

INSERT INTO recipients (id, type, email, whatsapp, website) VALUES
  (1, 'party', 'public@example.org', '972501234567', 'https://example.org');
INSERT INTO recipient_translations (recipient_id, locale, name) VALUES
  (1, 'en', 'Public Service Office'), (1, 'he', 'המשרד לשירות הציבור'),
  (1, 'ar', 'مكتب الخدمة العامة'), (1, 'yi', 'ביוראָ פֿאַר עפֿנטלעכן דינסט'),
  (1, 'ru', 'Управление общественной службы'), (1, 'am', 'የሕዝብ አገልግሎት ጽሕፈት ቤት');

INSERT INTO message_templates (locale, channel, subject, body) VALUES
  ('en', 'email', 'A personal civic request', 'Hello {recipient},\n\nI ask you to address:\n{demands}\n\n{context}\n\n{name}\n{city}'),
  ('en', 'whatsapp', NULL, 'Hello {recipient}. My civic request: {demands} {context}'),
  ('he', 'email', 'בקשה אזרחית אישית', 'שלום {recipient},\n\nאבקש להתייחס לדרישות הבאות:\n{demands}\n\n{context}\n\n{name}\n{city}'),
  ('he', 'whatsapp', NULL, 'שלום {recipient}. הבקשה האזרחית שלי: {demands} {context}'),
  ('ar', 'email', 'طلب مدني شخصي', 'مرحباً {recipient}،\n\nأطلب معالجة المطالب التالية:\n{demands}\n\n{context}\n\n{name}\n{city}'),
  ('ar', 'whatsapp', NULL, 'مرحباً {recipient}. طلبي المدني: {demands} {context}'),
  ('yi', 'email', 'אַ פּערזענלעכע בירגערלעכע בקשה', 'שלום {recipient},\n\nאיך בעט אײַך צו באַהאַנדלען:\n{demands}\n\n{context}\n\n{name}\n{city}'),
  ('yi', 'whatsapp', NULL, 'שלום {recipient}. מײַן בירגערלעכע בקשה: {demands} {context}'),
  ('ru', 'email', 'Личное гражданское обращение', 'Здравствуйте, {recipient}!\n\nПрошу рассмотреть требования:\n{demands}\n\n{context}\n\n{name}\n{city}'),
  ('ru', 'whatsapp', NULL, 'Здравствуйте, {recipient}. Моё гражданское обращение: {demands} {context}'),
  ('am', 'email', 'የግል የዜግነት ጥያቄ', 'ሰላም {recipient}፣\n\nእነዚህን ጥያቄዎች እንዲመለከቱ እጠይቃለሁ፦\n{demands}\n\n{context}\n\n{name}\n{city}'),
  ('am', 'whatsapp', NULL, 'ሰላም {recipient}። የዜግነት ጥያቄዬ፦ {demands} {context}');

