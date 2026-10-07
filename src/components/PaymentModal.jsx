import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [isClosing, setIsClosing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Smooth animated exit handler
  const handleClose = useCallback(() => {
    if (isSubmitting || isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 220);
  }, [isSubmitting, isClosing, onClose]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

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
    if (isSubmitting || isCompressing || isClosing) return;

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
      setIsClosing(true);
      setTimeout(() => {
        onClose();
      }, 200);
    } catch (err) {
      console.error('Payment settlement failed:', err);
      const msg = err.message || 'Failed to process payment.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-xs transition-opacity duration-200 ${
        isClosing ? 'animate-fade-out opacity-0 pointer-events-none' : 'animate-fade-in'
      }`}
    >
      {/* Backdrop Dismiss */}
      <div className="absolute inset-0" onClick={handleClose} />

      {/* Modal / Bottom-Sheet Container */}
      <div
        className={`relative w-full sm:max-w-md md:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 flex flex-col max-h-[92dvh] sm:max-h-[88vh] overflow-hidden sm:border sm:border-slate-200 ${
          isClosing
            ? 'animate-slide-down-out sm:animate-pop-out'
            : 'animate-slide-up-in sm:animate-pop-in'
        }`}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-0.5 shrink-0 bg-slate-50">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="px-4 py-2.5 sm:px-6 sm:py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                #{orderNumber}
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 truncate">
                {tableName}
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 mt-0.5 truncate">
              Settle Order Payment
            </h2>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleClose}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer shrink-0 text-xs sm:text-sm font-bold"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3 sm:px-6 sm:py-4.5 space-y-3 sm:space-y-4 overscroll-contain">
          {/* Proportional Total Due Display */}
          <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl bg-slate-900 text-white flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Due
              </span>
              <span className="text-lg sm:text-xl font-black tracking-tight text-white leading-tight">
                {currency} {Number(totalAmount).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-400">
                {order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'items'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Awaiting Pay
              </span>
            </div>
          </div>

          {/* Payment Method Selector (Proportional Symmetrical 2x2 Grid) */}
          <div>
            <label className="block text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5 sm:mb-2">
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
                    className={`h-[58px] sm:h-[62px] px-2.5 sm:px-3 py-1.5 rounded-xl text-left border transition-all flex items-center gap-2.5 cursor-pointer touch-manipulation ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border overflow-hidden p-1 ${
                      isSelected ? 'bg-white border-indigo-200 shadow-2xs' : 'bg-white border-slate-200'
                    }`}>
                      {method.iconUrl ? (
                        <img
                          src={method.iconUrl}
                          alt={method.label}
                          className="w-full h-full object-contain rounded-xs"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-base sm:text-lg leading-none">{method.icon}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs sm:text-sm font-bold truncate ${isSelected ? 'text-indigo-950 font-black' : 'text-slate-800'}`}>
                          {method.label}
                        </span>
                        {isSelected && (
                          <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[8px] font-black shrink-0">
                            ✓
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5 leading-tight">
                        {method.shortDesc || method.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Proof of Payment / Receipt Photo Upload (Proportional Layout) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
              <label className="text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">
                Receipt Photo / SMS Proof
              </label>
              <span className="text-[10px] font-medium text-slate-400">
                (Optional for Telebirr & CBE)
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
                  className="h-[54px] sm:h-[60px] px-2.5 sm:px-3 rounded-xl border border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/30 text-slate-700 flex items-center gap-2.5 transition-all cursor-pointer group touch-manipulation"
                >
                  <div className="w-8 h-8 rounded-lg bg-white shadow-2xs border border-slate-200 flex items-center justify-center text-sm sm:text-base shrink-0 group-hover:scale-105 transition-transform">
                    📷
                  </div>
                  <div className="min-w-0 text-left">
                    <span className="block text-xs font-bold text-slate-800 leading-tight">Take Photo</span>
                    <span className="block text-[10px] text-slate-400 truncate leading-tight mt-0.5">Camera</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-[54px] sm:h-[60px] px-2.5 sm:px-3 rounded-xl border border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/30 text-slate-700 flex items-center gap-2.5 transition-all cursor-pointer group touch-manipulation"
                >
                  <div className="w-8 h-8 rounded-lg bg-white shadow-2xs border border-slate-200 flex items-center justify-center text-sm sm:text-base shrink-0 group-hover:scale-105 transition-transform">
                    🖼️
                  </div>
                  <div className="min-w-0 text-left">
                    <span className="block text-xs font-bold text-slate-800 leading-tight">Upload Image</span>
                    <span className="block text-[10px] text-slate-400 truncate leading-tight mt-0.5">Gallery / SMS</span>
                  </div>
                </button>
              </div>
            ) : (
              <div className="h-[54px] sm:h-[60px] px-2.5 rounded-xl border border-slate-200 bg-slate-50/80 flex items-center gap-2.5">
                <img
                  src={previewUrl}
                  alt="Receipt Preview"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover border border-slate-200 shadow-2xs shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {rawFile?.name || 'Receipt Photo'}
                  </p>
                  {isCompressing ? (
                    <div className="flex items-center gap-1 text-[10px] text-amber-600 mt-0.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                      <span>Optimizing to WebP...</span>
                    </div>
                  ) : optimizedFile ? (
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      <span className="font-bold text-emerald-700">WebP: {formatFileSize(optimizedFile.size)}</span>
                      <span className="text-emerald-600 ml-1">(-{Math.round((1 - optimizedFile.size / rawFile.size) * 100)}%)</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{formatFileSize(rawFile?.size)}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={isSubmitting}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  title="Remove receipt"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2">
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

        {/* Modal Footer Actions (Proportional Height and Spacing) */}
        <div
          className="px-4 py-3 sm:px-6 sm:py-3.5 bg-white border-t border-slate-100 flex items-center gap-2.5 sm:gap-3 shrink-0"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))' }}
        >
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleClose}
            className="h-11 sm:h-12 px-4 sm:px-6 rounded-xl text-xs sm:text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition-colors cursor-pointer shrink-0"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSubmitting || isCompressing}
            onClick={handleSubmit}
            className="flex-1 h-11 sm:h-12 px-4 rounded-xl text-xs sm:text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer touch-manipulation"
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

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
