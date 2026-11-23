import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

export const metadata: Metadata = { title: "Admin sign in" };

export default function AdminLoginPage() {
  return (
    <section className="page-gutter flex min-h-[70vh] items-center justify-center bg-ink py-16">
      <div className="w-full max-w-md border border-gold-muted/50 bg-charcoal p-7 sm:p-10">
        <p className="type-eyebrow text-gold">Toxido administration</p>
        <h1 className="type-heading mt-4 text-ivory">Secure sign in</h1>
        <p className="mt-4 text-sm leading-6 text-muted">Use an authorized Supabase account to access store operations.</p>
        <AdminLoginForm />
      </div>
    </section>
  );
}
