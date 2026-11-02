'use client';

import { useId } from 'react';
import Link from 'next/link';
import { Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { validateDocumentFile } from '@/lib/documents';

export default function DocumentUploadDialog({ open, onOpenChange, trigger, form, onFormChange,
  testbank = false, onTestbankChange, uploading, error, onErrorChange, onSubmit }) {
  const id = useId();
  const formats = testbank ? '.pdf,.docx,.txt' : '.pdf,.docx,.pptx,.txt';
  const selectFile = (event) => {
    const file = event.target.files?.[0] || null;
    onFormChange({ ...form, file });
    try { if (file) validateDocumentFile(file, testbank); onErrorChange(''); }
    catch (error) { onErrorChange(error.message); }
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
            <Label htmlFor={`${id}-file`}>File</Label>
            <Input id={`${id}-file`} type="file" accept={formats} onChange={selectFile} disabled={uploading}
              aria-describedby={`${id}-formats`} className="h-auto min-h-11 py-2 file:mr-3 file:cursor-pointer" />
            <p id={`${id}-formats`} className="text-xs text-muted-foreground">{testbank ? 'PDF, DOCX or TXT' : 'PDF, DOCX, PPTX or TXT'} · Up to 20 MB</p>
            {form.file && <div className="flex min-w-0 items-start gap-2 rounded-md bg-muted p-3 text-sm">
              <FileText aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0"><p className="break-all font-medium">{form.file.name}</p>
                <p className="text-xs text-muted-foreground">{(form.file.size / 1024 / 1024).toFixed(2)} MB</p></div>
            </div>}
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
            {uploading ? <span className="flex gap-2"><Loader2 aria-hidden="true" className="h-4 w-4 mt-0.5 shrink-0 animate-spin motion-reduce:animate-none" />Uploading your file. You can close this dialog; the upload will continue.</span>
              : 'After upload, processing continues in the background. You can keep working.'}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{uploading ? 'Hide upload' : 'Cancel'}</Button>
            <Button type="submit" disabled={uploading}>{uploading ? 'Uploading…' : testbank ? 'Upload testbank' : 'Upload document'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
