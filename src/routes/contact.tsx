import React from 'react';
import { createFileRoute } from '@tanstack/react-router';

export default createFileRoute({
  id: 'contact',
  path: '/contact',
  component: function ContactPage() {
    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '24px auto' }}>
        <h1>Contact / تواصل</h1>
        <p>للتواصل حول الدعم أو الاعلانات أو المشروعات، أرسل رسالة إلى: <strong>support@dxfix.com</strong></p>
        <p>يمكنك أيضاً استخدام البريد الإلكتروني أعلاه لطلب إزالة المحتوى أو الأسئلة التقنية.</p>
      </div>
    );
  }
});
