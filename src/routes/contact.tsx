import React from 'react';
import { createFileRoute } from '@tanstack/react-router';

function ContactPage() {
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '24px auto' }}>
      <h1>Contact / تواصل</h1>
      <p>للتواصل حول الدعم أو الاعلانات أو المشروعات، أرسل رسالة إلى: <strong>mtmsk125@yahoo.com</strong></p>
      <p>يمكنك أيضاً استخدام البريد الإلكتروني أعلاه لطلب إزالة المحتوى أو الأسئلة التقنية.</p>
    </div>
  );
}

export const Route = createFileRoute('/contact')({
  component: ContactPage,
});
