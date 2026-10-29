import { Download, ExternalLink, FileText, Pencil, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { Button } from '../components/ui/Button';
import { ActionMenu, Card, PageHeader, usePageTitle } from '../components/ui/Bits';
import { ConfirmDialog, Dialog } from '../components/ui/Dialog';
import { EmptyState, ErrorState, Notice, SkeletonRows } from '../components/ui/Feedback';
import { TextField } from '../components/ui/Form';
import { useToast } from '../components/ui/Toast';
import { ApiError, errorMessage } from '../lib/api';
import { MAX_RESUME_BYTES } from '../lib/constants';
import { openResume } from '../lib/files';
import { formatBytes, formatDate } from '../lib/format';
import { useDeleteResume, useRenameResume, useResumes, useUploadResume } from '../lib/queries';
import type { Resume } from '../lib/types';

function validateFile(file: File): string | null {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return 'Only PDF files are supported.';
  if (file.size > MAX_RESUME_BYTES) return `That file is ${formatBytes(file.size)}. The limit is 5 MB.`;
  if (file.size === 0) return 'That file is empty.';
  return null;
}

export function ResumesPage() {
  usePageTitle('Resumes');
  const toast = useToast();
  const { data, isLoading, error, refetch } = useResumes();
  const upload = useUploadResume();
  const rename = useRenameResume();
  const del = useDeleteResume();

  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [renaming, setRenaming] = useState<Resume | null>(null);
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<Resume | null>(null);
  const [busyFile, setBusyFile] = useState<string | null>(null);

  function pick(file: File | undefined) {
    if (!file) return;
    setFileError(validateFile(file));
    setPending(file);
    setName(file.name.replace(/\.pdf$/i, '').slice(0, 120));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files[0]);
  }

  async function doUpload() {
    if (!pending || fileError) return;
    try {
      await upload.mutateAsync({ file: pending, name: name.trim() || pending.name });
      toast.success('Resume uploaded', 'Stored privately. Only you can open it.');
      setPending(null);
    } catch (err) {
      setFileError(errorMessage(err));
      toast.error('Upload failed', errorMessage(err));
    }
  }

  async function doRename() {
    if (!renaming) return;
    try {
      await rename.mutateAsync({ id: renaming.id, name: newName.trim() });
      toast.success('Resume renamed');
      setRenaming(null);
    } catch (err) {
      toast.error('Could not rename', errorMessage(err));
    }
  }

  async function doDelete() {
    if (!deleting) return;
    try {
      const r = await del.mutateAsync(deleting.id);
      if (r.storageCleanup === 'failed') toast.warning('Resume deleted, but file cleanup failed', 'The record is gone. The stored file could not be removed and may need manual cleanup.');
      else toast.success('Resume deleted');
      setDeleting(null);
    } catch (err) {
      toast.error('Could not delete the resume', errorMessage(err));
    }
  }

  async function open(r: Resume, disposition: 'inline' | 'attachment') {
    setBusyFile(`${r.id}:${disposition}`);
    try {
      await openResume(r.id, disposition);
    } catch (err) {
      toast.error('Could not open the resume', errorMessage(err));
    } finally {
      setBusyFile(null);
    }
  }

  const storageDown = error instanceof ApiError && error.status === 503;

  return (
    <>
      <PageHeader
        title="Resumes"
        description="Keep versions of your resume and attach them to applications."
        actions={
          <Button variant="primary" onClick={() => inputRef.current?.click()}>
            <Upload aria-hidden="true" /> Upload PDF
          </Button>
        }
      />
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} aria-label="Choose a PDF resume" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />

      <div className="stack">
        <Notice>
          PDF only, up to 5 MB. Files are stored in a private bucket and opened through short-lived links after an ownership check. This prototype does not scan uploads for malware, so only upload files you trust.
        </Notice>

        <div
          className={`dropzone ${dragging ? 'dropzone--over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <Upload aria-hidden="true" />
          <p>
            Drag a PDF here, or{' '}
            <button type="button" className="link-btn" onClick={() => inputRef.current?.click()}>
              browse files
            </button>
          </p>
        </div>

        <Card title="Your resumes" subtitle={data ? `${data.length} of 20 stored` : undefined} flush>
          {isLoading ? (
            <SkeletonRows rows={3} label="Loading resumes" />
          ) : error ? (
            <ErrorState error={error} onRetry={storageDown ? undefined : refetch} title={storageDown ? 'File storage is not configured' : 'Could not load resumes'} />
          ) : data!.length === 0 ? (
            <EmptyState icon={FileText} title="No resumes yet" text="Upload a PDF to keep it handy and attach it to applications." actions={<Button variant="primary" onClick={() => inputRef.current?.click()}><Upload aria-hidden="true" /> Upload PDF</Button>} />
          ) : (
            <ul>
              {data!.map((r) => (
                <li key={r.id} className="resume-row">
                  <div className="resume-row__icon" aria-hidden="true">
                    <FileText />
                  </div>
                  <div className="resume-row__main">
                    <div className="list-row__title truncate">{r.name}</div>
                    <div className="list-row__sub truncate">
                      {r.originalFilename} · {formatBytes(r.sizeBytes)} · Uploaded {formatDate(r.createdAt.slice(0, 10))} · Used by {r.applicationCount} {r.applicationCount === 1 ? 'application' : 'applications'}
                    </div>
                  </div>
                  <div className="resume-row__actions">
                    <Button size="sm" onClick={() => open(r, 'inline')} loading={busyFile === `${r.id}:inline`} aria-label={`Preview ${r.name}`}>
                      <ExternalLink aria-hidden="true" /> <span className="hide-sm">Preview</span>
                    </Button>
                    <Button size="sm" onClick={() => open(r, 'attachment')} loading={busyFile === `${r.id}:attachment`} aria-label={`Download ${r.name}`}>
                      <Download aria-hidden="true" /> <span className="hide-sm">Download</span>
                    </Button>
                    <ActionMenu label={`More actions for ${r.name}`}>
                      {(close) => (
                        <>
                          <button
                            type="button"
                            className="menu__item"
                            onClick={() => {
                              close();
                              setRenaming(r);
                              setNewName(r.name);
                            }}
                          >
                            <Pencil aria-hidden="true" /> Rename
                          </button>
                          <button
                            type="button"
                            className="menu__item menu__item--danger"
                            onClick={() => {
                              close();
                              setDeleting(r);
                            }}
                          >
                            <Trash2 aria-hidden="true" /> Delete
                          </button>
                        </>
                      )}
                    </ActionMenu>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Dialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        dismissible={!upload.isPending}
        title="Upload resume"
        description={pending ? `${pending.name} · ${formatBytes(pending.size)}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)} disabled={upload.isPending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={doUpload} loading={upload.isPending} disabled={Boolean(fileError)}>
              Upload
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 'var(--s-4)' }}>
          <TextField label="Display name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} hint="Shown when you attach it to an application." />
          {fileError && (
            <div className="notice notice--danger" role="alert">
              {fileError}
            </div>
          )}
        </div>
      </Dialog>

      <Dialog
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        title="Rename resume"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={doRename} loading={rename.isPending} disabled={!newName.trim()}>
              Save name
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) doRename();
          }}
        >
          <TextField label="Name" value={newName} maxLength={120} onChange={(e) => setNewName(e.target.value)} autoFocus />
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this resume?"
        description={
          <>
            <strong>{deleting?.name}</strong> and its stored file will be deleted. Applications that used it keep working but will no longer show a resume. This cannot be undone.
          </>
        }
        confirmLabel="Delete resume"
        busy={del.isPending}
        onConfirm={doDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
