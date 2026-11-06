'use client';

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, FileText, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { validateDocumentFile } from '@/lib/documents';

export default function DocumentUploadDialog({ open, onOpenChange, trigger, form, onFormChange,
  testbank = false, onTestbankChange, uploading, error, onErrorChange, onSubmit }) {
  const id = useId();
  const fileInput = useRef(null);
  const chooseButton = useRef(null);
  const [dragging, setDragging] = useState(false);
  const formats = testbank ? '.pdf,.docx,.txt,.rtf' : '.pdf,.docx,.pptx,.txt,.rtf';
  let fileError = '';
  if (form.file) {
    try { validateDocumentFile(form.file, testbank); }
    catch (error) { fileError = error.message; }
  }
  const selectFiles = (files) => {
    if (uploading || !files?.length) return;
    if (files.length > 1) {
      onErrorChange('Choose one file at a time.');
      return;
    }
    const file = files[0];
    onFormChange({ ...form, file });
    onErrorChange('');
  };
  const removeFile = () => {
    onFormChange({ ...form, file: null });
    onErrorChange('');
    if (fileInput.current) fileInput.current.value = '';
    chooseButton.current?.focus();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{onTestbankChange ? 'Upload a document' : 'Import a testbank'}</DialogTitle>
          <DialogDescription>
            {testbank ? 'Extract questions and answer keys for this module. AI-extracted questions will need your review.' : 'Add course material for search and question generation.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5" aria-busy={uploading}>
          {onTestbankChange && <fieldset disabled={uploading} className="space-y-2">
            <legend className="text-sm font-medium mb-2">What are you uploading?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[{ value: false, label: 'Course material', detail: 'Notes, readings or slides' },
                { value: true, label: 'Testbank', detail: 'Questions with answer keys' }].map(kind => (
                <label key={kind.label} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${testbank === kind.value ? 'border-primary bg-accent' : 'border-input'}`}>
                  <input className="mt-1 accent-current" type="radio" name={`${id}-kind`} checked={testbank === kind.value}
                    onChange={() => { onTestbankChange(kind.value); onErrorChange(''); }} />
                  <span><span className="block text-sm font-medium">{kind.label}</span><span className="text-xs text-muted-foreground">{kind.detail}</span></span>
                </label>
              ))}
            </div>
          </fieldset>}
          <div className="space-y-2">
            <Label htmlFor={`${id}-file`}>Document file</Label>
            <input ref={fileInput} id={`${id}-file`} type="file" accept={formats} disabled={uploading}
              aria-label="Document file" className="hidden"
              onChange={event => { selectFiles(event.target.files); event.target.value = ''; }} />
            <div
              onDragOver={event => {
                event.preventDefault();
                if (!uploading && event.dataTransfer.types.includes('Files')) setDragging(true);
              }}
              onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
              onDrop={event => { event.preventDefault(); setDragging(false); selectFiles(event.dataTransfer.files); }}
              className={`rounded-lg border p-4 transition-colors motion-reduce:transition-none ${fileError ? 'border-destructive bg-destructive/5' : dragging ? 'border-primary bg-accent' : 'border-dashed border-input bg-muted/20'}`}
            >
              {form.file ? (
                <div className="flex min-w-0 items-start gap-3" role="status">
                  <FileText aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="break-all text-sm font-medium">{form.file.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {form.file.size < 1024 * 1024 ? `${Math.max(1, Math.ceil(form.file.size / 1024))} KB` : `${(form.file.size / 1024 / 1024).toFixed(1)} MB`}
                      {!fileError && (uploading ? ' · Uploading…' : ' · Ready to upload')}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 -mt-2 -mr-2"
                    disabled={uploading} onClick={removeFile} aria-label="Remove selected file">
                    <X aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <Upload aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div><p className="text-sm font-medium">Choose a file to upload</p>
                    <p className="mt-1 text-sm text-muted-foreground">Browse your device or drag a file here.</p></div>
                </div>
              )}
              <Button ref={chooseButton} id={`${id}-choose`} type="button" variant="outline" className="mt-4 min-h-11 w-full sm:w-auto"
                disabled={uploading} onClick={() => fileInput.current?.click()}
                aria-describedby={`${id}-formats${fileError ? ` ${id}-file-error` : ''}`}>
                {form.file ? 'Replace file' : 'Choose file'}
              </Button>
            </div>
            <p id={`${id}-formats`} className="text-xs text-muted-foreground">{testbank ? 'PDF, DOCX, TXT or RTF' : 'PDF, DOCX, PPTX, TXT or RTF'} · One file, up to 20 MB</p>
            {fileError && <p id={`${id}-file-error`} role="alert" className="text-sm text-destructive">{fileError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-title`}>Title <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id={`${id}-title`} value={form.title} maxLength={255} disabled={uploading}
              onChange={event => onFormChange({ ...form, title: event.target.value })} placeholder="Use the filename" />
          </div>
          {error && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
            {/sign in/i.test(error) && <Link href="/sign-in" className="ml-1 font-medium underline">Sign in</Link>}
          </div>}
          <div role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {uploading ? <span className="flex gap-2"><Loader2 aria-hidden="true" className="h-4 w-4 mt-0.5 shrink-0 animate-spin motion-reduce:animate-none" />Uploading your file. You can close this dialog, but keep this page open.</span>
              : 'After upload, processing continues in the background. You can keep working.'}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{uploading ? 'Hide upload' : 'Cancel'}</Button>
            <Button type="submit" disabled={uploading || Boolean(fileError)}>{uploading ? 'Uploading…' : testbank ? 'Upload testbank' : 'Upload document'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
