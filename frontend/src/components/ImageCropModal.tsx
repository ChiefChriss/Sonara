import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { getCroppedImg } from '../utils/cropImage';

interface ImageCropModalProps {
    /** Object-URL or data-URL of the image to crop */
    imageSrc: string;
    /** Aspect ratio (e.g. 1 for square, 16/9 for header). Omit for free crop. */
    aspect?: number;
    /** 'round' for profile pictures, 'rect' for everything else */
    cropShape?: 'round' | 'rect';
    /** Called with the cropped image blob when the user clicks Apply */
    onCropComplete: (croppedBlob: Blob) => void;
    /** Called when the user cancels the crop */
    onCancel: () => void;
}

const ImageCropModal = ({
    imageSrc,
    aspect = 1,
    cropShape = 'rect',
    onCropComplete,
    onCancel,
}: ImageCropModalProps) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [applying, setApplying] = useState(false);

    const handleCropComplete = useCallback((_: Area, croppedPixels: Area) => {
        setCroppedAreaPixels(croppedPixels);
    }, []);

    const handleApply = async () => {
        if (!croppedAreaPixels) return;
        setApplying(true);
        try {
            const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
            onCropComplete(blob);
        } catch {
            // Fallback: if cropping fails for some reason, pass original as-is
            const res = await fetch(imageSrc);
            const blob = await res.blob();
            onCropComplete(blob);
        } finally {
            setApplying(false);
        }
    };

    return (
        <div style={styles.overlay}>
            <style>{`
        .crop-zoom-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 200px;
          height: 4px;
          border-radius: 2px;
          background: rgba(255,255,255,0.2);
          outline: none;
        }
        .crop-zoom-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #00d4ff;
          cursor: pointer;
          box-shadow: 0 0 8px rgba(0, 212, 255, 0.5);
        }
        .crop-zoom-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #00d4ff;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 8px rgba(0, 212, 255, 0.5);
        }
      `}</style>

            <div style={styles.modal}>
                {/* Header */}
                <div style={styles.header}>
                    <h3 style={styles.title}>Crop Image</h3>
                </div>

                {/* Cropper area */}
                <div style={styles.cropContainer}>
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect}
                        cropShape={cropShape}
                        showGrid={cropShape === 'rect'}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={handleCropComplete}
                    />
                </div>

                {/* Zoom control */}
                <div style={styles.controls}>
                    <span style={styles.zoomLabel}>🔍</span>
                    <input
                        type="range"
                        className="crop-zoom-slider"
                        min={1}
                        max={3}
                        step={0.05}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                    />
                    <span style={styles.zoomValue}>{Math.round(zoom * 100)}%</span>
                </div>

                {/* Actions */}
                <div style={styles.actions}>
                    <button
                        type="button"
                        onClick={onCancel}
                        style={styles.cancelBtn}
                        disabled={applying}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleApply}
                        style={styles.applyBtn}
                        disabled={applying}
                    >
                        {applying ? 'Applying...' : 'Apply Crop'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
    },
    modal: {
        width: '90vw',
        maxWidth: '600px',
        borderRadius: '20px',
        background: 'rgba(20, 30, 55, 0.95)',
        border: '1px solid rgba(100, 150, 200, 0.25)',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Poppins', sans-serif",
    },
    header: {
        padding: '18px 24px 14px',
        borderBottom: '1px solid rgba(100, 150, 200, 0.15)',
    },
    title: {
        margin: 0,
        fontSize: '18px',
        fontWeight: 700,
        color: '#ffffff',
    },
    cropContainer: {
        position: 'relative',
        width: '100%',
        height: '380px',
        background: '#0a0a1a',
    },
    controls: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '16px 24px',
        borderTop: '1px solid rgba(100, 150, 200, 0.15)',
    },
    zoomLabel: {
        fontSize: '16px',
    },
    zoomValue: {
        fontSize: '13px',
        color: 'rgba(255, 255, 255, 0.6)',
        minWidth: '42px',
        textAlign: 'right',
    },
    actions: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end',
        padding: '14px 24px 20px',
        borderTop: '1px solid rgba(100, 150, 200, 0.1)',
    },
    cancelBtn: {
        padding: '10px 22px',
        borderRadius: '9999px',
        border: '2px solid rgba(100, 150, 200, 0.3)',
        background: 'transparent',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: "'Poppins', sans-serif",
        transition: 'border-color 0.2s',
    },
    applyBtn: {
        padding: '10px 22px',
        borderRadius: '9999px',
        border: 'none',
        background: 'linear-gradient(135deg, #00d4ff 0%, #00b4d8 50%, #0096c7 100%)',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: "'Poppins', sans-serif",
        boxShadow: '0 4px 15px rgba(0, 212, 255, 0.3)',
        transition: 'opacity 0.2s',
    },
};

export default ImageCropModal;
