import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  ClipboardList,
  MapPin,
  MapPinOff,
  Navigation,
  Calendar,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Loader2,
  Phone,
  User,
  Camera,
  Video,
  X
} from 'lucide-react';

export const VisitFormPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const customerIdParam = searchParams.get('customer');

  const [customer, setCustomer] = useState<any>(null);
  const [choices, setChoices] = useState<any>({ remarks: [], switching_reasons: [], switching_to_isps: [], visit_statuses: [] });
  const [loading, setLoading] = useState(true);

  // Form State
  const [visitStatus, setVisitStatus] = useState('COMPLETED');
  const [remark, setRemark] = useState('');
  const [switchingReason, setSwitchingReason] = useState('');
  const [switchingTo, setSwitchingTo] = useState('');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [photoEvidenceId, setPhotoEvidenceId] = useState<number | null>(null);
  const [videoEvidenceId, setVideoEvidenceId] = useState<number | null>(null);
  const [photoUploadState, setPhotoUploadState] = useState<'IDLE' | 'UPLOADING' | 'UPLOADED' | 'ERROR'>('IDLE');
  const [videoUploadState, setVideoUploadState] = useState<'IDLE' | 'UPLOADING' | 'UPLOADED' | 'ERROR'>('IDLE');
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<'PHOTO' | 'VIDEO' | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const discardRecordingRef = useRef(false);

  // GPS State
  const [gpsLatitude, setGpsLatitude] = useState<number | null>(null);
  const [gpsLongitude, setGpsLongitude] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'IDLE' | 'ACQUIRING' | 'SUCCESS' | 'DENIED' | 'UNAVAILABLE'>('IDLE');
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);
  const [showGpsRequiredModal, setShowGpsRequiredModal] = useState(false);

  // Follow-up Scheduling State
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  useEffect(() => {
    if (!videoFile) {
      setVideoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(videoFile);
    setVideoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  useEffect(() => {
    if (cameraPreviewRef.current && cameraStream) {
      cameraPreviewRef.current.srcObject = cameraStream;
    }
  }, [cameraMode, cameraStream]);

  useEffect(() => () => {
    if (recordingTimerRef.current !== null) {
      window.clearTimeout(recordingTimerRef.current);
    }
    cameraStream?.getTracks().forEach((track) => track.stop());
  }, [cameraStream]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [choicesRes, custRes] = await Promise.all([
          api.get('/visits/choices/'),
          customerIdParam ? api.get(`/customers/${customerIdParam}/`) : Promise.resolve(null),
        ]);
        setChoices(choicesRes.data);
        if (custRes) {
          setCustomer(custRes.data);
        }
      } catch (e) {
        console.error('Error loading visit form dependencies', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [customerIdParam]);

  // Request browser location
  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('UNAVAILABLE');
      setGpsErrorMessage('Geolocation is not supported by your browser.');
      return;
    }

    setGpsStatus('ACQUIRING');
    setGpsErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLatitude(Number(pos.coords.latitude.toFixed(7)));
        setGpsLongitude(Number(pos.coords.longitude.toFixed(7)));
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setGpsStatus('SUCCESS');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus('DENIED');
          setGpsErrorMessage('Location permission was denied. You may still submit if device permits.');
        } else {
          setGpsStatus('UNAVAILABLE');
          setGpsErrorMessage('Unable to retrieve GPS position. Please check device location settings.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const stopCamera = () => {
    if (recordingTimerRef.current !== null) {
      window.clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraMode(null);
    setIsRecording(false);
  };

  const uploadCapturedEvidence = async (file: File, type: 'photo' | 'video') => {
    const oldEvidenceId = type === 'photo' ? photoEvidenceId : videoEvidenceId;
    if (type === 'photo') {
      setPhotoUploadState('UPLOADING');
      setPhotoEvidenceId(null);
    } else {
      setVideoUploadState('UPLOADING');
      setVideoEvidenceId(null);
    }

    try {
      if (oldEvidenceId) {
        await api.delete(`/visits/evidence-uploads/${oldEvidenceId}/`);
      }
      const formData = new FormData();
      formData.append('customer_id', String(customer.id));
      formData.append(type, file);
      const response = await api.post('/visits/evidence-uploads/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (type === 'photo') {
        setPhotoEvidenceId(response.data.id);
        setPhotoUploadState('UPLOADED');
      } else {
        setVideoEvidenceId(response.data.id);
        setVideoUploadState('UPLOADED');
      }
      setEvidenceError(null);
    } catch (uploadError: any) {
      console.error(`Visit ${type} upload failed`, uploadError);
      if (type === 'photo') {
        setPhotoUploadState('ERROR');
      } else {
        setVideoUploadState('ERROR');
      }
      setEvidenceError(uploadError.response?.data?.detail || `Could not upload the ${type}. It will retry when you complete the visit.`);
    }
  };

  const removeEvidence = async (type: 'photo' | 'video') => {
    const evidenceId = type === 'photo' ? photoEvidenceId : videoEvidenceId;
    if (evidenceId) {
      try {
        await api.delete(`/visits/evidence-uploads/${evidenceId}/`);
      } catch (deleteError) {
        console.error(`Could not remove uploaded visit ${type}`, deleteError);
        setEvidenceError(`Could not remove the uploaded ${type}. Please refresh and try again.`);
        return;
      }
    }
    if (type === 'photo') {
      setPhotoFile(null);
      setPhotoEvidenceId(null);
      setPhotoUploadState('IDLE');
    } else {
      setVideoFile(null);
      setVideoEvidenceId(null);
      setVideoUploadState('IDLE');
    }
  };

  const openCamera = async (mode: 'PHOTO' | 'VIDEO') => {
    setCameraError(null);
    setEvidenceError(null);
    if (!customer?.id) {
      setCameraError('Select a customer before capturing visit evidence.');
      setCameraMode(mode);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not available. Open this page over HTTPS and allow camera permission.');
      setCameraMode(mode);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: mode === 'VIDEO',
        video: { facingMode: { ideal: 'environment' } },
      });
      setCameraStream(stream);
      setCameraMode(mode);
    } catch (cameraRequestError) {
      console.error('Camera access failed', cameraRequestError);
      setCameraError('Could not open the camera. Allow camera permission and try again.');
      setCameraMode(mode);
    }
  };

  const capturePhoto = () => {
    const preview = cameraPreviewRef.current;
    if (!preview || !preview.videoWidth || !preview.videoHeight) {
      setCameraError('Camera is still starting. Please try again in a moment.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = preview.videoWidth;
    canvas.height = preview.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('Could not capture the photo. Please try again.');
      return;
    }
    context.drawImage(preview, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('Could not save the photo. Please try again.');
        return;
      }
      if (blob.size > 10 * 1024 * 1024) {
        setCameraError('Photo must be 10 MB or smaller. Try a lower-resolution camera setting.');
        return;
      }
      const file = new File([blob], `visit-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setPhotoFile(file);
      setEvidenceError(null);
      stopCamera();
      void uploadCapturedEvidence(file, 'photo');
    }, 'image/jpeg', 0.88);
  };

  const stopRecording = () => {
    if (recordingTimerRef.current !== null) {
      window.clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  };

  const startRecording = () => {
    if (!cameraStream || typeof MediaRecorder === 'undefined') {
      setCameraError('Video recording is not supported by this browser.');
      return;
    }

    const mimeType = ['video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      setCameraError('This browser does not support a compatible video format.');
      return;
    }

    recordingChunksRef.current = [];
    setRecordingSeconds(0);
    setCameraError(null);

    try {
      const recorder = new MediaRecorder(cameraStream, {
        mimeType,
        videoBitsPerSecond: 2_000_000,
      });
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setCameraError('Video recording failed. Please try again.');
        stopCamera();
      };
      recorder.onstop = () => {
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          recordingChunksRef.current = [];
          stopCamera();
          return;
        }
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        if (blob.size > 50 * 1024 * 1024) {
          setCameraError('Video is larger than 50 MB. Please record again at a lower camera resolution.');
          stopCamera();
          return;
        }
        const file = new File([blob], `visit-video-${Date.now()}.${extension}`, { type: mimeType });
        setVideoFile(file);
        setEvidenceError(null);
        stopCamera();
        void uploadCapturedEvidence(file, 'video');
      };
      recorder.start(500);
      discardRecordingRef.current = false;
      setIsRecording(true);
      recordingTimerRef.current = window.setTimeout(() => {
        setRecordingSeconds(20);
        stopRecording();
      }, 20_000);
      const startedAt = Date.now();
      const updateRecordingTime = () => {
        if (recorder.state !== 'recording') return;
        setRecordingSeconds(Math.min(20, Math.floor((Date.now() - startedAt) / 1000)));
        window.setTimeout(updateRecordingTime, 250);
      };
      updateRecordingTime();
    } catch (recordingError) {
      console.error('Video recording failed', recordingError);
      setCameraError('Could not start video recording. Please try again.');
    }
  };

  const cancelCamera = () => {
    if (recorderRef.current?.state === 'recording') {
      discardRecordingRef.current = true;
      stopRecording();
    }
    stopCamera();
  };

  const isSwitchingToIsp = remark === 'Switching to another ISP';
  const requiresSwitchingReason = [
    'Switching to another ISP',
    'Denied - Higher pricing than other ISPs',
    'Denied — Higher pricing than other ISPs',
    'Highly dissatisfied after price increment',
    'Denied - Poor service',
    'Denied — Poor service'
  ].includes(remark);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer?.id) {
      setError('No customer selected for visit.');
      return;
    }
    if (!remark) {
      setError('Please select a Follow-up Remark.');
      return;
    }
    if (visitStatus === 'COMPLETED' && (gpsLatitude === null || gpsLongitude === null)) {
      setShowGpsRequiredModal(true);
      setError('GPS is required before completing the visit. Please capture GPS first.');
      return;
    }
    if (isSwitchingToIsp && !switchingTo) {
      setError('Please select which ISP the customer is switching to.');
      return;
    }
    if (requiresSwitchingReason && !switchingReason) {
      setError('Please specify the switching / churn reason.');
      return;
    }
    if (photoUploadState === 'UPLOADING' || videoUploadState === 'UPLOADING') {
      setError('Please wait for captured photo and video uploads to finish.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload: Record<string, string | number | null> = {
        customer_id: customer.id,
        visit_status: visitStatus,
        follow_up_remark: remark,
        switching_reason: switchingReason,
        switching_to: switchingTo,
        notes: notes.trim(),
        gps_latitude: gpsLatitude,
        gps_longitude: gpsLongitude,
        gps_accuracy: gpsAccuracy,
      };

      if (scheduleFollowUp && followUpDate) {
        payload.follow_up_date = followUpDate;
        payload.follow_up_notes = followUpNotes.trim();
      }

      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          formData.append(key, String(value));
        }
      });
      if (photoFile) formData.append('photo', photoFile);
      if (videoFile) formData.append('video', videoFile);
      if (photoEvidenceId) {
        formData.delete('photo');
        formData.append('photo_evidence_id', String(photoEvidenceId));
      }
      if (videoEvidenceId) {
        formData.delete('video');
        formData.append('video_evidence_id', String(videoEvidenceId));
      }

      await api.post('/visits/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigate(`/customers/${customer.id}?visit_success=true`);
    } catch (err: any) {
      console.error('Visit submit error:', err.response?.data || err);
      const data = err.response?.data;
      let msg = 'Failed to submit visit. Please check required fields.';
      if (typeof data === 'string') {
        msg = data;
      } else if (data && typeof data === 'object') {
        if (data.detail) {
          msg = data.detail;
        } else {
          const fieldErrors = Object.entries(data)
            .map(([field, errs]) => {
              const fieldName = field.replace(/_/g, ' ');
              const errText = Array.isArray(errs) ? errs.join(', ') : String(errs);
              return `${fieldName}: ${errText}`;
            })
            .join(' | ');
          if (fieldErrors) {
            msg = fieldErrors;
          }
        }
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-red"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Top Bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Record Visit Findings</h2>
          <p className="text-xs text-text-secondary">Capture field observations and GPS verification</p>
        </div>
      </div>

      {/* Customer Header Card */}
      {customer && (
        <div className="bg-surface rounded-card-md p-5 shadow-card border border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3 mb-3">
            <div>
              <span className="text-xs text-text-secondary font-medium">Customer:</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-base font-bold font-mono text-brand-red-dark">{customer.customer_id}</span>
                <span className="text-base font-bold text-text-primary">{customer.customer_name || 'Name Unknown'}</span>
              </div>
            </div>
            {customer.phone_number && (
              <a
                href={`tel:${customer.phone_number}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold w-fit"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call {customer.phone_number}</span>
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-text-secondary">Churn Days:</span>{' '}
              <strong className="text-text-primary">{customer.churn_days} days</strong>
            </div>
            <div>
              <span className="text-text-secondary">Package:</span>{' '}
              <strong className="text-text-primary">{customer.package || 'N/A'}</strong>
            </div>
            <div>
              <span className="text-text-secondary">Record Source:</span>{' '}
              <strong className="text-text-primary">{customer.record_source === 'AGENT_MANUAL' ? 'Agent Manual' : 'Excel Upload'}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Main Visit Form */}
      <div className="bg-surface rounded-card-md shadow-card border border-border p-6 md:p-8">
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-danger text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Visit Status */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
              Visit Status *
            </label>
            <select
              value={visitStatus}
              onChange={(e) => setVisitStatus(e.target.value)}
              className="w-full px-4 py-3 bg-input-bg border-b-2 border-input-focus rounded-t-md text-sm font-medium text-text-primary focus:outline-none"
              required
            >
              {choices.visit_statuses.map((st: any) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          {/* Follow-up Remark (19 choices) */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
              Follow-up Remark * (Select Exact Business Finding)
            </label>
            <select
              value={remark}
              onChange={(e) => {
                setRemark(e.target.value);
                if (e.target.value !== 'Switching to another ISP') {
                  setSwitchingTo('');
                }
              }}
              className="w-full px-4 py-3 bg-input-bg border-b-2 border-input-focus rounded-t-md text-sm font-semibold text-text-primary focus:outline-none"
              required
            >
              <option value="">-- Select Follow-up Remark --</option>
              {choices.remarks.map((r: string, idx: number) => (
                <option key={idx} value={r}>
                  {idx + 1}. {r}
                </option>
              ))}
            </select>
          </div>

          {/* Conditional: Switching To (9 competitor ISPs) */}
          {isSwitchingToIsp && (
            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2 animate-fadeIn">
              <label className="block text-xs font-bold text-warning uppercase">
                Destination ISP * (Switching To)
              </label>
              <select
                value={switchingTo}
                onChange={(e) => setSwitchingTo(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-border rounded-lg text-sm font-medium text-text-primary focus:outline-none focus:border-brand-red"
                required
              >
                <option value="">-- Select Destination ISP --</option>
                {choices.switching_to_isps.map((isp: string, idx: number) => (
                  <option key={idx} value={isp}>
                    {isp}
                  </option>
                ))}
                <option value="Other / Unknown">Other / Unknown</option>
              </select>
            </div>
          )}

          {/* Conditional: Switching Reason (9 reasons) */}
          {requiresSwitchingReason && (
            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2 animate-fadeIn">
              <label className="block text-xs font-bold text-warning uppercase">
                Switching / Churn Reason *
              </label>
              <select
                value={switchingReason}
                onChange={(e) => setSwitchingReason(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-border rounded-lg text-sm font-medium text-text-primary focus:outline-none focus:border-brand-red"
                required
              >
                <option value="">-- Select Switching Reason --</option>
                {choices.switching_reasons.map((rs: string, idx: number) => (
                  <option key={idx} value={rs}>
                    {rs}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Field Notes */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
              Field Notes / Customer Feedback
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record any verbal commitments, feedback, or specific details of the discussion..."
              rows={3}
              className="w-full px-4 py-3 bg-input-bg border-b-2 border-input-focus rounded-t-md text-sm text-text-primary focus:outline-none resize-none"
            />
          </div>

          {/* Optional Visit Evidence */}
          <div className="p-4 bg-gray-50 border border-border rounded-xl space-y-4">
            <div>
              <h4 className="text-xs font-bold text-text-primary uppercase">Visit Photo & Video</h4>
              <p className="text-[11px] text-text-secondary mt-1">
                Optional evidence. Add one photo and a video up to 20 seconds.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <span className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
                  <Camera className="w-4 h-4 text-brand-red" />
                  Photo (max 10 MB)
                </span>
                <button
                  type="button"
                  onClick={() => openCamera('PHOTO')}
                  className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-semibold text-brand-red-dark shadow-sm hover:bg-brand-red-light"
                >
                  <Camera className="h-4 w-4" />
                  Capture Photo
                </button>
                {photoPreviewUrl && (
                  <div className="relative w-fit">
                    <img src={photoPreviewUrl} alt="Visit evidence preview" className="max-h-40 rounded-lg border border-border" />
                    <button
                      type="button"
                      onClick={() => void removeEvidence('photo')}
                      className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-danger shadow"
                      aria-label="Remove photo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {photoFile && (
                  <p className="text-[11px] font-medium text-success">
                    {photoUploadState === 'UPLOADING' ? 'Uploading photo...' : photoUploadState === 'UPLOADED' ? 'Photo uploaded and attached.' : 'Photo ready; will upload when visit is completed.'}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <span className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
                  <Video className="w-4 h-4 text-brand-red" />
                  Video (up to 20 sec, max 50 MB)
                </span>
                <button
                  type="button"
                  onClick={() => openCamera('VIDEO')}
                  className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-semibold text-brand-red-dark shadow-sm hover:bg-brand-red-light"
                >
                  <Video className="h-4 w-4" />
                  Record Video
                </button>
                {videoPreviewUrl && (
                  <div className="relative w-fit">
                    <video src={videoPreviewUrl} controls playsInline className="max-h-40 max-w-full rounded-lg border border-border" />
                    <button
                      type="button"
                      onClick={() => void removeEvidence('video')}
                      className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-danger shadow"
                      aria-label="Remove video"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {videoFile && (
                  <p className="text-[11px] font-medium text-success">
                    {videoUploadState === 'UPLOADING' ? 'Uploading video...' : videoUploadState === 'UPLOADED' ? 'Video uploaded and attached.' : 'Video ready; will upload when visit is completed.'}
                  </p>
                )}
              </div>
            </div>
            {evidenceError && (
              <div className="flex items-center gap-2 text-xs font-medium text-danger">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{evidenceError}</span>
              </div>
            )}
            <p className="text-[11px] text-text-secondary">
              Photo uploads after capture. Video stops automatically at 20 seconds and uploads; both are attached to the visit when completed.
            </p>
          </div>

          {/* GPS Verification Section */}
          <div className="p-4 bg-gray-50 border border-border rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-text-primary uppercase flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-brand-red" />
                  <span>GPS Location Verification</span>
                </h4>
                <p className="text-[11px] text-text-secondary">
                  Captures your current field coordinates at visit completion with your permission.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCaptureGps}
                disabled={gpsStatus === 'ACQUIRING'}
                className="px-3 py-2 bg-gray-100 hover:bg-brand-red-light text-brand-red-dark border border-brand-red/30 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1 shrink-0"
              >
                {gpsStatus === 'ACQUIRING' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MapPin className="w-3.5 h-3.5" />
                )}
                <span>{gpsStatus === 'SUCCESS' ? 'Recapture GPS' : 'Capture GPS'}</span>
              </button>
            </div>

            {gpsStatus === 'SUCCESS' && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-success flex items-center justify-between font-mono">
                <span>Lat: {gpsLatitude?.toFixed(6)}, Lng: {gpsLongitude?.toFixed(6)}</span>
                <span className="text-[10px] text-text-secondary font-sans font-medium">
                  Accuracy: ±{gpsAccuracy}m
                </span>
              </div>
            )}

            {gpsErrorMessage && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-danger flex items-center gap-1.5">
                <MapPinOff className="w-3.5 h-3.5 shrink-0" />
                <span>{gpsErrorMessage}</span>
              </div>
            )}
          </div>

          {/* Follow-up Scheduling Accordion */}
          <div className="border border-border rounded-xl p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={scheduleFollowUp}
                onChange={(e) => setScheduleFollowUp(e.target.checked)}
                className="w-4 h-4 rounded border-border text-brand-red focus:ring-brand-red accent-brand-red cursor-pointer"
              />
              <span className="text-xs font-bold text-text-primary uppercase flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-brand-red" />
                <span>Schedule Next Follow-up Date</span>
              </span>
            </label>

            {scheduleFollowUp && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Follow-up Due Date *
                  </label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 bg-input-bg border-b-2 border-input-focus rounded-t-md text-xs font-medium focus:outline-none"
                    required={scheduleFollowUp}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Follow-up Action Notes
                  </label>
                  <input
                    type="text"
                    value={followUpNotes}
                    onChange={(e) => setFollowUpNotes(e.target.value)}
                    placeholder="e.g. Call regarding recharge discount confirmation"
                    className="w-full px-3 py-2 bg-input-bg border-b-2 border-input-focus rounded-t-md text-xs focus:outline-none"
                  />
                </div>

                {cameraMode && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
                    <div className="w-full max-w-xl space-y-4 rounded-xl bg-white p-4 shadow-2xl">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-text-primary">
                          {cameraMode === 'PHOTO' ? 'Take Visit Photo' : 'Record Visit Video'}
                        </h3>
                        <button
                          type="button"
                          onClick={cancelCamera}
                          className="rounded-full p-2 text-text-secondary hover:bg-gray-100"
                          aria-label="Close camera"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      {cameraStream ? (
                        <video
                          ref={cameraPreviewRef}
                          autoPlay
                          muted
                          playsInline
                          className="max-h-[60vh] w-full rounded-lg bg-black object-contain"
                        />
                      ) : (
                        <div className="flex min-h-48 items-center justify-center rounded-lg bg-gray-100 text-sm text-text-secondary">
                          {cameraError ? 'Camera unavailable' : <Loader2 className="h-6 w-6 animate-spin" />}
                        </div>
                      )}
                      {cameraError && (
                        <div className="flex items-center gap-2 text-xs text-danger">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          {cameraError}
                        </div>
                      )}
                      {isRecording && (
                        <p className="text-center text-sm font-bold text-danger">
                          ● Recording {recordingSeconds}/20 sec
                        </p>
                      )}
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelCamera}
                          className="rounded-md px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                        {cameraMode === 'PHOTO' ? (
                          <button
                            type="button"
                            onClick={capturePhoto}
                            disabled={!cameraStream}
                            className="rounded-md bg-brand-red px-5 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
                          >
                            Done — Capture Photo
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={isRecording ? stopRecording : startRecording}
                            disabled={!cameraStream}
                            className="rounded-md bg-brand-red px-5 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
                          >
                            {isRecording ? 'Stop & Attach Video' : 'Start Recording'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky Complete Visit Button */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-3 text-xs font-semibold text-text-secondary hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || photoUploadState === 'UPLOADING' || videoUploadState === 'UPLOADING'}
              className="px-8 py-3.5 bg-brand-red hover:bg-brand-red-dark text-white text-xs font-bold uppercase rounded-lg shadow-md transition-all flex items-center gap-2 disabled:opacity-50 min-h-[48px]"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Complete Visit</span>
            </button>
          </div>
        </form>
      </div>

      {showGpsRequiredModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-100 p-2 text-danger">
                <MapPinOff className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-text-primary">GPS Required</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  This visit cannot be marked complete until GPS coordinates are captured from the field.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowGpsRequiredModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGpsRequiredModal(false);
                  handleCaptureGps();
                }}
                className="rounded-lg bg-brand-red px-4 py-2 text-xs font-bold uppercase text-white"
              >
                Capture GPS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
