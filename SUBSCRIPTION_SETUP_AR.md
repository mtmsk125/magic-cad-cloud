# نظام الحماية بالاشتراك - دليل سريع

## ملخص التنفيذ
تم تنفيذ نظام حماية شامل يضمن أن المستخدمين غير المشتركين لا يمكنهم الوصول إلى أداة تحرير ملفات DXF (CAD Editor).

## كيفية عمل النظام

### 1. المستخدم غير المشترك يحاول الوصول للأداة
```
المستخدم ينقر "ابدأ — ارفع ملف DXF"
                ↓
يحاول الدخول إلى صفحة /tool
                ↓
يتم فحص حالة الاشتراك في beforeLoad
                ↓
لا يوجد اشتراك ← إعادة توجيه إلزامية
                ↓
ينقل المستخدم إلى صفحة الأسعار
                ↓
يظهر إشعار: "اشتراك مطلوب"
                ↓
يرى قائمة الأسعار والخطط
```

### 2. المستخدم يشترك عبر Paddle
```
ينقر على خطة "Pro" أو "Workshop"
                ↓
نافذة الدفع تفتح
                ↓
يدخل بيانات الدفع
                ↓
الدفع ناجح
                ↓
يتم حفظ بيانات الاشتراك
                ↓
إعادة توجيه تلقائية إلى أداة /tool
                ↓
الأداة تفتح مباشرة
```

### 3. المستخدم المشترك يدخل الأداة
```
يحاول الدخول إلى /tool
                ↓
يتم فحص الاشتراك ← موجود ✓
                ↓
الأداة تفتح بدون مشاكل
```

## الملفات المضافة والمعدلة

### ملفات جديدة
| الملف | الغرض |
|------|------|
| `src/lib/subscription.ts` | إدارة حالة الاشتراك وتخزينها |
| `src/hooks/use-subscription.tsx` | هوك React للتحقق من الاشتراك |
| `src/components/subscription-prompt.tsx` | بانر التنبيه عند إعادة التوجيه |
| `src/components/subscription-status.tsx` | عرض حالة الاشتراك |
| `src/components/tool-cta-button.tsx` | زر ذكي يتحقق من الاشتراك |
| `src/lib/SUBSCRIPTION_SYSTEM.md` | التوثيق الكامل |

### ملفات معدلة
| الملف | التعديل |
|------|---------|
| `src/routes/tool.tsx` | إضافة `beforeLoad` للفحص والحماية |
| `src/lib/paddle.ts` | تحديث للتعامل مع اتمام الاشتراك |
| `src/routes/__root.tsx` | إضافة `SubscriptionPrompt` |

## كيفية الاستخدام

### للمطورين - التحقق من الاشتراك في المكونات

```tsx
import { useSubscription } from '@/hooks/use-subscription';

function MyComponent() {
  const { isSubscribed, status, data } = useSubscription();

  if (!isSubscribed) {
    return <p>يرجى الاشتراك أولاً</p>;
  }

  return <p>مرحباً {data.email}!</p>;
}
```

### لعرض حالة الاشتراك

```tsx
import { SubscriptionStatus } from '@/components/subscription-status';

function Header() {
  return <SubscriptionStatus size="sm" />;
}
```

## بيانات الاشتراك المخزنة

يتم حفظ المعلومات في `localStorage` تحت المفتاح `dxfix_subscription`:

```json
{
  "status": "pro",           // أو "workshop" أو "free" أو null
  "email": "user@example.com",
  "customerId": "cus_xxx",
  "subscriptionId": "sub_xxx",
  "lastChecked": 1703001234567
}
```

## الحالات المشمولة

✅ **محمي بالكامل:**
- منع الوصول إلى `/tool` للمستخدمين غير المشتركين
- إعادة توجيه قسرية إلى صفحة الأسعار
- حفظ الاشتراك بعد الدفع الناجح
- إعادة التوجيه إلى الأداة بعد الاشتراك

✅ **ميزات إضافية:**
- رسالة تنبيه عند محاولة الوصول بدون اشتراك
- تمرير تلقائي إلى قسم الأسعار
- عرض حالة الاشتراك للمستخدمين الموثوقين
- دعم كامل للغة العربية

## اختبار النظام

### تنظيف واختبار من جديد
```javascript
// في وحدة تحكم المتصفح
localStorage.removeItem('dxfix_subscription');
```

### محاكاة اشتراك Pro
```javascript
localStorage.setItem('dxfix_subscription', JSON.stringify({
  status: 'pro',
  email: 'test@example.com',
  lastChecked: Date.now()
}));
// ثم حاول الدخول إلى /tool
```

### محاكاة اشتراك Workshop
```javascript
localStorage.setItem('dxfix_subscription', JSON.stringify({
  status: 'workshop',
  email: 'test@example.com',
  lastChecked: Date.now()
}));
```

## ملاحظات أمان

⚠️ **اعتبارات الإنتاج:**
1. **التحقق من الخادم:** يجب إضافة التحقق من الخادم في مرحلة الإنتاج
2. **Webhooks:** يجب ربط مع Paddle webhooks للتحديثات الفورية
3. **التشفير:** قد تحتاج لتشفير بيانات الاشتراك
4. **الجلسات:** استخدام JWT أو sessions بدلاً من localStorage فقط

## المتطلبات والتبعيات

- ✅ TanStack Router (موجود)
- ✅ React Hooks (موجود)
- ✅ Paddle (متكامل)
- ✅ localStorage API (المتصفح)

## الخطوات التالية

1. **تفعيل Paddle:** تأكد من تعيين متغيرات البيئة:
   - `VITE_PADDLE_CLIENT_TOKEN`
   - `VITE_PADDLE_PRO_PRICE_ID`
   - `VITE_PADDLE_WORKSHOP_PRICE_ID`

2. **الاختبار:** اختبر جميع الحالات المذكورة أعلاه

3. **التحسينات المستقبلية:**
   - إضافة التحقق من الخادم
   - تطبيق Paddle webhooks
   - إضافة فترة تجريبية مجانية
   - تتبع سجل الاشتراكات

## الدعم والمساعدة

في حالة وجود مشاكل:
1. تحقق من وحدة تحكم المتصفح للأخطاء
2. تأكد من حالة localStorage: `console.log(localStorage.getItem('dxfix_subscription'))`
3. تحقق من أن Paddle محمل: `console.log(window.Paddle)`
4. اطلع على `src/lib/SUBSCRIPTION_SYSTEM.md` للتفاصيل الكاملة
