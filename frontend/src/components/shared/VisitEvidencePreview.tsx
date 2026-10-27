import React, { useEffect, useState } from 'react';
import { AlertCircle, Image as ImageIcon, Loader2, Video, X } from 'lucide-react';
import api from '../../services/api';

interface VisitEvidencePreviewProps {
  visitId: number;
  evidenceType: 'photo' | 'video';
}

export const VisitEvidencePreview: React.FC<VisitEvidencePreviewProps> = ({
  visitId,
  evidenceType,
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaUrl) return;
    return () => URL.revokeObjectURL(mediaUrl);
  }, [mediaUrl]);

  const handleOpen = async () => {
    setOpen(true);
    setError(null);
    if (mediaUrl) return;

    try {
      setLoading(true);
      const response = await api.get(
        `/visits/${visitId}/evidence/${evidenceType}/`,
        { responseType: 'blob' },
      );
      setMediaUrl(URL.createObjectURL(response.data));
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'Could not load visit evidence.');
    } finally {
      setLoading(false);
    }
  };

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-text-secondary hover:border-brand-red hover:text-brand-red"
      >
        {evidenceType === 'photo' ? <ImageIcon className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
        {evidenceType === 'photo' ? 'Photo' : 'Video'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={close}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl rounded-xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              className="absolute -right-3 -top-3 rounded-full bg-white p-1.5 text-text-primary shadow"
              aria-label="Close evidence preview"
            >
              <X className="h-5 w-5" />
            </button>
            {loading ? (
              <div className="flex min-h-40 min-w-64 items-center justify-center gap-2 text-sm text-text-secondary">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading evidence...
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 p-8 text-sm text-danger">
                <AlertCircle className="h-5 w-5" />
                {error}
              </div>
            ) : mediaUrl && evidenceType === 'photo' ? (
              <img src={mediaUrl} alt="Visit evidence" className="max-h-[80vh] max-w-full object-contain" />
            ) : mediaUrl ? (
              <video src={mediaUrl} controls autoPlay playsInline className="max-h-[80vh] max-w-full" />
            ) : null}
          </div>
        </div>
      )}
    </>
  );
};
