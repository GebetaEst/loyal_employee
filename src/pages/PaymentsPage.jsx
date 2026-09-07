import EmployeeLayout from '../components/EmployeeLayout';

export default function PaymentsPage() {
  return (
    <EmployeeLayout>
      <div className="flex flex-col gap-6 animate-fade-in max-w-lg mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-slate-900">Payments</h1>
          <p className="text-xs text-slate-500 mt-0.5">Cashier payment processing workspace</p>
        </div>

        {/* Placeholder Info Box */}
        <div className="glass bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-4 text-center my-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-slate-100 border border-slate-200 text-3xl">
            💳
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Payment Workspace</h3>
            <p className="text-xs text-slate-500 mt-2 max-w-[280px] leading-relaxed">
              Cashier payment workflow will be enabled when the payment API is finalized.
            </p>
          </div>
        </div>
      </div>
    </EmployeeLayout>
  );
}
