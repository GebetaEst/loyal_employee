import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { PAYMENT_METHODS, submitOrderPayment } from '../api/paymentService';
import { convertBrowserFileToWebP, formatFileSize, validateReceiptImage } from '../lib/imageOptimization';

export default function PaymentModal({ order, onClose, onSuccess }) {
  const [selectedMethod, setSelectedMethod] = useState('telebirr');
  const [rawFile, setRawFile] = useState(null);
  const [optimizedFile, setOptimizedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isSubmitting]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!order) return null;

  const orderId = order.id || order._id;
  const orderNumber = order.orderNumber || '---';
  const tableName = order.table?.name || (order.table?.code ? `Table ${order.table.code}` : (typeof order.table === 'string' ? `Table ${order.table}` : 'N/A'));
  const totalAmount = order.pricing?.total || 0;
  const currency = order.pricing?.currency || 'ETB';

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    const validation = validateReceiptImage(file);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      toast.error(validation.error);
      return;
    }

    setRawFile(file);
    setIsCompressing(true);

    try {
      // Create preview
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // Convert to WebP client-side via HTML5 canvas (Quality 80, Max 1600px)
      const webpFile = await convertBrowserFileToWebP(file, 1600, 0.8);
      setOptimizedFile(webpFile);
    } catch (err) {
      console.error('WebP conversion failed:', err);
      toast.error(err.message || 'Failed to optimize image format');
      setOptimizedFile(null);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemovePhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setRawFile(null);
    setOptimizedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || isCompressing) return;

    setIsSubmitting(true);
    setErrorMessage('');
    setUploadProgress(0);

    try {
      const fileToUpload = optimizedFile || rawFile;
      const result = await submitOrderPayment(orderId, {
        method: selectedMethod,
        file: fileToUpload,
        onProgress: (p) => setUploadProgress(p),
      });

      toast.success(result.message || 'Payment recorded successfully!');
      if (onSuccess) {
        onSuccess(result.order);
      }
      onClose();
    } catch (err) {
      console.error('Payment settlement failed:', err);
      const msg = err.message || 'Failed to process payment.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={() => !isSubmitting && onClose()} />

      {/* Modal / Bottom-Sheet Container */}
      <div className="relative w-full sm:max-w-md md:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 flex flex-col max-h-[92dvh] sm:max-h-[88vh] overflow-hidden border border-slate-200 animate-fade-in-up">
        {/* Mobile Drag Indicator Handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-0.5 shrink-0 bg-slate-50/90">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] sm:text-xs font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                #{orderNumber}
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 truncate">
                {tableName}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5 truncate">
              Settle Order Payment
            </h2>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer shrink-0 text-xs sm:text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4.5 overscroll-contain">
          {/* Bill Total Display */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Due
              </span>
              <span className="text-xl sm:text-2xl font-black tracking-tight">
                {currency} {Number(totalAmount).toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block">
                {order.items?.length || 0} items
              </span>
              <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Awaiting Pay
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
              Select Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {PAYMENT_METHODS.map((method) => {
                const isSelected = selectedMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setSelectedMethod(method.id)}
                    className={`p-2.5 sm:p-3.5 rounded-2xl text-left border transition-all flex items-start gap-2.5 sm:gap-3 cursor-pointer touch-manipulation ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xl sm:text-2xl shrink-0 mt-0.5">{method.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className={`text-xs sm:text-sm font-black truncate ${isSelected ? 'text-indigo-950' : 'text-slate-900'}`}>
                          {method.label}
                        </span>
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0 ml-auto" />
                        )}
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight mt-0.5 line-clamp-2">
                        {method.fullName || method.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Proof of Payment / Receipt Photo Upload */}
          <div>
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
              <label className="text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <span>Receipt Photo / SMS Proof</span>
              </label>
              <span className="text-[10px] font-semibold text-slate-400">
                (Recommended for Telebirr & CBE)
              </span>
            </div>

            {/* Hidden native inputs */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />

            {!previewUrl ? (
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="p-3 sm:p-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/40 text-slate-700 flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer group touch-manipulation"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-lg sm:text-xl group-hover:scale-105 transition-transform">
                    📷
                  </div>
                  <span className="text-xs font-bold text-slate-800">Take Photo</span>
                  <span className="text-[10px] text-slate-400 text-center leading-tight">Camera snapshot</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 sm:p-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/40 text-slate-700 flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer group touch-manipulation"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-lg sm:text-xl group-hover:scale-105 transition-transform">
                    🖼️
                  </div>
                  <span className="text-xs font-bold text-slate-800">Upload Image</span>
                  <span className="text-[10px] text-slate-400 text-center leading-tight">Gallery / SMS proof</span>
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex items-center gap-2.5 sm:gap-3">
                <img
                  src={previewUrl}
                  alt="Receipt Preview"
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {rawFile?.name || 'Receipt Photo'}
                  </p>
                  {isCompressing ? (
                    <div className="flex items-center gap-1 text-[11px] text-amber-600 mt-0.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                      <span>Converting to WebP...</span>
                    </div>
                  ) : optimizedFile ? (
                    <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 space-y-0.5 leading-tight">
                      <p>
                        <span className="text-slate-400">Orig:</span> {formatFileSize(rawFile?.size)} →{' '}
                        <span className="font-bold text-emerald-700">WebP: {formatFileSize(optimizedFile.size)}</span>
                      </p>
                      <p className="text-[10px] text-emerald-600 font-semibold truncate">
                        Reduced by ~{Math.round((1 - optimizedFile.size / rawFile.size) * 100)}% for fast upload
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 mt-0.5">Size: {formatFileSize(rawFile?.size)}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={isSubmitting}
                  className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                  title="Remove receipt"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2">
              <span className="text-sm shrink-0">⚠️</span>
              <p className="flex-1 mt-0.5 leading-snug">{errorMessage}</p>
            </div>
          )}

          {/* Upload Progress Bar */}
          {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                <span>Uploading receipt to Cloudinary...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-200 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </form>

        {/* Modal Footer Actions (Fixed at bottom with safe-area spacing for mobile) */}
        <div
          className="px-4 py-3 sm:px-6 sm:py-4 bg-white border-t border-slate-100 flex items-center justify-between gap-2.5 sm:gap-3 shrink-0"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))' }}
        >
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSubmitting || isCompressing}
            onClick={handleSubmit}
            className="flex-1 py-2.5 sm:py-3 px-3 sm:px-5 rounded-2xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-md hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer touch-manipulation"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Processing...</span>
              </>
            ) : isCompressing ? (
              <span>Optimizing Image...</span>
            ) : (
              <span className="truncate">Confirm Payment ({currency} {Number(totalAmount).toFixed(2)})</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
