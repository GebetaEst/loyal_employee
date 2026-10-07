import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export default function ReceiptPreviewModal({ url, orderNumber, onClose }) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 220);
  }, [isClosing, onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  if (!url) return null;

  const modalContent = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm transition-opacity duration-200 ${
        isClosing ? 'animate-fade-out opacity-0 pointer-events-none' : 'animate-fade-in'
      }`}
    >
      <div className="absolute inset-0" onClick={handleClose} />
      <div
        className={`relative max-w-md w-full bg-white rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col border border-slate-200 ${
          isClosing ? 'animate-pop-out' : 'animate-pop-in'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="text-sm font-black text-slate-900">Payment Receipt Proof</h3>
            <p className="text-xs text-slate-500">Order #{orderNumber}</p>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer text-xs sm:text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Image Content */}
        <div className="p-3 sm:p-4 bg-slate-100 flex items-center justify-center max-h-[70vh] overflow-auto">
          <img
            src={url}
            alt={`Receipt proof for order ${orderNumber}`}
            className="max-h-[60vh] max-w-full rounded-2xl object-contain shadow-md border border-slate-200"
          />
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-100 flex justify-between items-center">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open Original Image
          </a>
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
