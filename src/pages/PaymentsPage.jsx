import EmployeeLayout from '../components/EmployeeLayout';

export default function PaymentsPage() {
  return (
    <EmployeeLayout>
      <div className="flex flex-col gap-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-white">Payments</h1>
          <p className="text-xs text-white/40">Cashier payment processing workspace</p>
        </div>

        {/* Placeholder Info Box */}
        <div className="glass rounded-3xl p-8 border border-white/10 flex flex-col items-center justify-center gap-4 text-center my-10">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-3xl">
            💳
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Payment Workspace</h3>
            <p className="text-sm text-white/50 mt-2 max-w-[280px] leading-relaxed">
              Cashier payment workflow will be enabled when the payment API is finalized.
            </p>
          </div>
        </div>
      </div>
    </EmployeeLayout>
  );
}
