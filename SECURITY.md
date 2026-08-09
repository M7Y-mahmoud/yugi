# Security Rules - Firebase Realtime Database

يجب نسخ هذه القواعد ولصقها في قسم Rules الخاص بـ Firebase Realtime Database من خلال Firebase Console لحماية البيانات:

```json
{
  "rules": {
    "cards": {
      // القراءة متاحة للجميع (اللاعبين لعرض المكتبة)
      ".read": true,
      
      // الكتابة مسموحة فقط للمستخدم المسجل والموجود في قائمة المديرين
      ".write": "auth != null && root.child('admins').child(auth.uid).exists()",
      
      "$cardId": {
        // التحقق من صحة البيانات المُدخلة
        ".validate": "newData.hasChildren(['name', 'imageUrl', 'type', 'description'])",
        "name": { ".validate": "newData.isString()" },
        "imageUrl": { ".validate": "newData.isString()" },
        "type": { ".validate": "newData.val() == 'Monster' || newData.val() == 'Spell' || newData.val() == 'Trap'" },
        "description": { ".validate": "newData.isString()" },
        "atk": { ".validate": "!newData.exists() || newData.isNumber()" },
        "def": { ".validate": "!newData.exists() || newData.isNumber()" },
        "level": { ".validate": "!newData.exists() || (newData.isNumber() && newData.val() >= 1 && newData.val() <= 12)" }
      }
    },
    
    "admins": {
      // القراءة: مدير عام (superadmin) يمكنه قراءة الكل، والمدير العادي يقرأ بياناته فقط
      ".read": "auth != null && (root.child('admins').child(auth.uid).child('role').val() === 'superadmin')",
      
      // الكتابة: إضافة وتعديل المديرين متاحة فقط للـ superadmin
      ".write": "auth != null && root.child('admins').child(auth.uid).child('role').val() === 'superadmin'",
      
      "$uid": {
        // استثناء: المدير العادي يمكنه قراءة بياناته الخاصة
        ".read": "auth != null && auth.uid === $uid"
      }
    },
    
    "activityLogs": {
      // القراءة: المدير العام يقرأ كل السجلات، المدير العادي يحتاج لفلترة (أو يتم القراءة بناءً على صلاحيته)
      // في Realtime Database نستخدم الاستعلام (query) للتحقق، ولكن لتسهيل الأمر سنسمح للمديرين بقراءة السجل 
      // مع فلترته من الواجهة، أو يفضل عمل فهرسة (indexing).
      ".read": "auth != null && root.child('admins').child(auth.uid).exists()",
      
      // الكتابة (Append-only): الإضافة فقط ولا يمكن حذف أو تعديل أي سجل قديم
      ".write": "auth != null && root.child('admins').child(auth.uid).exists()",
      
      "$logId": {
        // منع تعديل أو حذف السجلات الموجودة مسبقًا
        ".write": "auth != null && root.child('admins').child(auth.uid).exists() && !data.exists()",
        
        ".validate": "newData.hasChildren(['adminId', 'action', 'timestamp'])",
        "adminId": { ".validate": "newData.val() === auth.uid" }
      }
    }
  }
}
```

### خطوات التطبيق:
1. اذهب إلى **Firebase Console**.
2. اختر مشروعك **yo-ge-f7397**.
3. من القائمة الجانبية، اذهب إلى **Realtime Database**.
4. اضغط على تبويب **Rules**.
5. انسخ الكود أعلاه واستبدله بالكود الموجود هناك.
6. اضغط على زر **Publish**.
7. يُنصح باستخدام **Rules Playground** في لوحة التحكم لاختبار محاولات القراءة والكتابة بصلاحيات مختلفة لضمان عمل القواعد بشكل صحيح.

## ملف الأمان العام والثغرات (Security Document)

يهدف هذا القسم إلى توثيق التهديدات المحتملة وطريقة التعامل معها في التطبيق:

### 1. هجمات حقن الأكواد (XSS)
- **التهديد**: إمكانية إدخال كود خبيث عبر وصف الكارت أو اسمه.
- **الحماية**: أي نص يُدخله الأدمن (خصوصًا description) يتم تمريره عبر `textContent` وليس `innerHTML` عند العرض. في حال استدعت الحاجة لاستخدام HTML محدود، يتم عمل Sanitization صريح.

### 2. التلاعب من جهة العميل (Client-side tampering)
- **التهديد**: تلاعب اللاعب بحالة اللعبة في المتصفح مثل عدّاد الديك (60 كارت) والخلط والسحب، والتي تعتمد على منطق محلي بالكامل.
- **الواقع**: لا يوجد "غش" حقيقي ممكن لأن اللعب يتم فعليًا على الطاولة بين اللاعبين، ولكن يُوثَّق أن هذه البيانات محلية وغير موثوقة أمنيًا ولا يُعتمد عليها في اتخاذ أي قرار حساس على الخادم.

### 3. حماية صفحات الأدمن
- **التهديد**: إمكانية وصول مستخدم عادي لصفحات الأدمن عبر الروابط المباشرة.
- **الحماية**: الحماية الحقيقية تكمن في قواعد قاعدة البيانات (Database Rules الموضحة أعلاه) والتي تمنع الوصول للبيانات وتعديلها تمامًا. إخفاء أو إعادة توجيه الروابط في الواجهة هو فقط لتحسين تجربة المستخدم.

### 4. التخزين المحلي الآمن
- **التهديد**: تخزين بيانات حساسة بشكل غير آمن.
- **الحماية**: عدم تخزين أي بيانات حساسة (كلمات مرور، توكنز مصادقة) في `sessionStorage` أو `localStorage`. يُسمح فقط بتخزين بيانات جلسة اللعب المؤقتة مثل (IDs الكروت، حالة اليد والمقبرة).

### 5. إعدادات Firebase العامة (Firebase Config)
- **التهديد**: رؤية المستخدم لبيانات إعداد Firebase في الكود المصدري للواجهة.
- **الحماية**: توضيح أن بيانات إعداد Firebase (API keys) ليست أسرارًا (Public by design). الحماية الحقيقية تكون عبر الـ Rules. مع توصية بتفعيل **Firebase App Check** لاحقًا لمنع استخدام الـ API من نطاقات غير مصرح بها.

### 6. صلاحيات الأدمن المتدرجة
- **التهديد**: محاولة أدمن بمرتبة عادية رفع مستوى صلاحياته إلى Superadmin.
- **الحماية**: التأكد أن أي أدمن عادي لا يقدر يوسّع صلاحياته بنفسه؛ قواعد الـ Rules تمنع الكتابة على مجموعة `admins` إلا لمن لديهم دور `superadmin` بالفعل.

### 7. مراقبة النشاطات (Activity Logs)
- **التهديد**: قيام أحد المديرين بعمليات تخريبية كحذف العديد من الكروت.
- **الحماية**: توصية بمراجعة دورية لسجل النشاطات (الذي لا يمكن التلاعب به أو حذفه من قبل المديرين العاديين) لرصد أي سلوك غير معتاد والتعامل معه.