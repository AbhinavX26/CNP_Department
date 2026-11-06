import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { Select } from '../common/Select';

interface InventoryItem {
  _id: string;
  name: string;
  description?: string;
  category?: string;
  availableQuantity: number;
  totalQuantity: number;
  location?: string;
  unitCost?: number | null;
}

interface RequestLine {
  key: number;
  itemId: string;
  quantity: number | '';
  specifications: string;
}

const formatMoney = (value: number) =>
  `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

interface MaterialRequestItem {
  _id: string;
  projectId: string;
  materialName?: string;
  inventoryItemId?: InventoryItem;
  quantity: number;
  specifications?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  route?: 'mentor' | 'admin';
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  documentUrl?: string;
  documentOriginalName?: string;
  imageUrl?: string;
}

interface ProjectMaterialRequestsProps {
  projectId: string;
  isTL?: boolean;
  /** Lifts the queue counts so the aside can plot approval coverage. */
  onStatsChange?: (stats: { total: number; approved: number; pending: number }) => void;
}

const STATUS_LABEL: Record<MaterialRequestItem['status'], string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATUS_TONE: Record<MaterialRequestItem['status'], string> = {
  pending: 'is-warning',
  approved: 'is-positive',
  rejected: 'is-negative',
};

const FileMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7 3.5h7l4 4V20.5H7V3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M14 3.5v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

const ImageMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="9" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.5" />
    <path d="m5 17 4.5-4.5 3 3L15 13l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

const CartMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3.5 5.5h2.2l2.2 9.5h10.6l2-7H7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="10" cy="19" r="1.1" fill="currentColor" />
    <circle cx="17" cy="19" r="1.1" fill="currentColor" />
  </svg>
);

export function ProjectMaterialRequests({ projectId, isTL = false, onStatsChange }: ProjectMaterialRequestsProps) {
  const [requests, setRequests] = useState<MaterialRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [lines, setLines] = useState<RequestLine[]>([]);
  const lineKey = useRef(1);
  const [budgetLimit, setBudgetLimit] = useState(5000);
  const [minJustification, setMinJustification] = useState(50);
  const [reason, setReason] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const fieldId = useId();
  const requestTrigger = useRef<HTMLButtonElement>(null);

  const fetchRequests = () => {
    api<any>('GET', `/material-requests/project/${projectId}`)
      .then((res) => setRequests(res.data || []))
      .catch((err) => {
        if (err.status !== 403) setError(err.message || 'Failed to load requests');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequests();
  }, [projectId]);

  useEffect(() => {
    onStatsChange?.({
      total: requests.length,
      approved: requests.filter((request) => request.status === 'approved').length,
      pending: requests.filter((request) => request.status === 'pending').length,
    });
  }, [requests, onStatsChange]);

  // Disable background page scrolling when the modal is open
  useEffect(() => {
    if (isModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && !submitting) closeModal();
      };
      document.addEventListener('keydown', onKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        document.removeEventListener('keydown', onKeyDown);
      };
    }
  }, [isModalOpen, submitting]);

  const openModal = async () => {
    setIsModalOpen(true);
    setSubmitError('');
    setSubmitSuccess('');
    setLoadingInventory(true);
    try {
      const [res, config] = await Promise.all([
        api<any>('GET', '/inventory'),
        api<any>('GET', '/material-requests/config').catch(() => null),
      ]);
      setInventoryItems(res.data || []);
      if (config?.data) {
        setBudgetLimit(Number(config.data.budgetLimit));
        setMinJustification(Number(config.data.minJustificationLength) || 50);
      }
      if (res.data && res.data.length > 0 && lines.length === 0) {
        const firstAvailable = res.data.find((i: InventoryItem) => i.availableQuantity > 0) || res.data[0];
        setLines([{ key: lineKey.current++, itemId: firstAvailable._id, quantity: 1, specifications: '' }]);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to load inventory items');
    } finally {
      setLoadingInventory(false);
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setLines([]);
    setReason('');
    setDocumentFile(null);
    setImageFile(null);
    setImagePreview(null);
    setSubmitError('');
    setSubmitSuccess('');
    requestTrigger.current?.focus();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setImageFile(null);
      setImagePreview(null);
    }
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setDocumentFile(file || null);
  };

  const itemById = (id: string) => inventoryItems.find((i) => i._id === id);
  const updateLine = (key: number, patch: Partial<RequestLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const removeLine = (key: number) => setLines((current) => current.filter((line) => line.key !== key));
  const addLine = () => {
    const used = new Set(lines.map((line) => line.itemId));
    const next = inventoryItems.find((i) => i.availableQuantity > 0 && !used.has(i._id));
    if (!next) return;
    setLines((current) => [...current, { key: lineKey.current++, itemId: next._id, quantity: 1, specifications: '' }]);
  };

  // The server decides the route; this mirrors its rule so the team sees it before sending.
  const pricing = (() => {
    let total = 0;
    let unpriced = false;
    for (const line of lines) {
      const cost = itemById(line.itemId)?.unitCost;
      if (cost === null || cost === undefined) unpriced = true;
      else total += cost * (Number(line.quantity) || 0);
    }
    return { total: Math.round(total * 100) / 100, unpriced };
  })();
  const overBudget = !pricing.unpriced && pricing.total > budgetLimit;
  const goesToAdmin = overBudget || pricing.unpriced;
  const needsLongReason = overBudget;
  const reasonTooShort = needsLongReason && reason.trim().length < minJustification;
  const linesInvalid = lines.length === 0 || lines.some((line) => {
    const item = itemById(line.itemId);
    const qty = Number(line.quantity);
    return !item || !qty || qty < 1 || qty > item.availableQuantity;
  });
  const duplicateItems = new Set(lines.map((line) => line.itemId)).size !== lines.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');

    if (lines.length === 0) {
      setSubmitError('Please select a material from inventory');
      return;
    }
    if (duplicateItems) {
      setSubmitError('The same item appears twice — combine it into one line');
      return;
    }
    for (const line of lines) {
      const item = itemById(line.itemId);
      const qty = Number(line.quantity);
      if (!item) {
        setSubmitError('Please select a material from inventory');
        return;
      }
      if (!qty || qty < 1) {
        setSubmitError('Requested quantity must be at least 1');
        return;
      }
      if (qty > item.availableQuantity) {
        setSubmitError(`Requested quantity (${qty}) for "${item.name}" exceeds available stock (${item.availableQuantity})`);
        return;
      }
    }

    if (!reason.trim()) {
      setSubmitError('Please provide a reason or explanation for this request');
      return;
    }
    if (reasonTooShort) {
      setSubmitError(
        `This request is above the ${formatMoney(budgetLimit)} limit, so it goes to the project admin. Please explain in at least ${minJustification} characters why these materials are needed.`,
      );
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('projectId', projectId);
      formData.append(
        'items',
        JSON.stringify(
          lines.map((line) => ({
            inventoryItemId: line.itemId,
            quantity: Number(line.quantity),
            specifications: line.specifications.trim(),
          })),
        ),
      );
      formData.append('reason', reason.trim());
      if (documentFile) {
        formData.append('document', documentFile);
      }
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const res = await api<any>('POST', '/material-requests', formData);
      setSubmitSuccess(
        res?.submission?.route === 'mentor'
          ? 'Request sent to your faculty mentor, who has been emailed.'
          : 'Request sent to the project admin, who has been emailed.',
      );
      fetchRequests();

      setTimeout(() => {
        closeModal();
      }, 1200);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit material request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (error) {
    return (
      <div className="ui-notice ui-notice--error" role="alert">
        {error}
      </div>
    );
  }

  return (
    <section className="ui-panel prj-requests" id="material-requests" aria-labelledby="prj-requests-title">
      <header className="ui-panel__head">
        <div className="ui-panel__titles">
          <h2 className="ui-panel__title" id="prj-requests-title">
            Material requests
          </h2>
          <span className="ui-panel__meta">{requests.length}</span>
        </div>
        {isTL && (
          <button
            ref={requestTrigger}
            type="button"
            className="ui-btn ui-btn--quiet ui-btn--sm"
            onClick={openModal}
          >
            Request materials
          </button>
        )}
      </header>

      <div className="ui-panel__body ui-panel__body--flush">
        {requests.length ? (
          <ul className="prj-request-list">
            {requests.map((req) => {
              const materialDisplayName = req.materialName || req.inventoryItemId?.name || 'Central inventory item';
              return (
                <li className="prj-request" key={req._id}>
                  <div className="prj-request__main">
                    <div className="prj-request__title-row">
                      <p className="prj-request__name">{materialDisplayName}</p>
                      <span className="prj-request__qty">×{req.quantity}</span>
                      {req.inventoryItemId?.category && (
                        <span className="ui-tag ui-tag--plain">{req.inventoryItemId.category}</span>
                      )}
                      <span className={`ui-tag ${STATUS_TONE[req.status] || STATUS_TONE.pending}`}>
                        {STATUS_LABEL[req.status] || 'Pending review'}
                      </span>
                      {req.status === 'pending' && (
                        <span className="ui-tag ui-tag--plain">
                          With {req.route === 'mentor' ? 'faculty mentor' : 'project admin'}
                        </span>
                      )}
                    </div>

                    {req.reason && <p className="prj-request__reason">{req.reason}</p>}
                    {req.specifications && (
                      <p className="prj-request__specs">
                        <span className="prj-request__label">Specifications</span> {req.specifications}
                      </p>
                    )}

                    <p className="prj-request__meta">
                      Requested{' '}
                      {new Date(req.createdAt).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {req.status !== 'pending' && req.reviewedAt && (
                        <>
                          <span aria-hidden="true"> · </span>
                          Reviewed{' '}
                          {new Date(req.reviewedAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {req.reviewedBy?.name ? ` by ${req.reviewedBy.name}` : ''}
                        </>
                      )}
                    </p>

                    {req.status === 'rejected' && req.rejectionReason && (
                      <div className="ui-notice ui-notice--error prj-request__rejection">
                        <div>
                          <strong>Rejection reason</strong>
                          <p>{req.rejectionReason}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {(req.imageUrl || req.documentUrl) && (
                    <div className="prj-request__files">
                      {req.imageUrl && (
                        <a
                          className="prj-file-chip"
                          href={req.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ImageMark />
                          Photo
                        </a>
                      )}
                      {req.documentUrl && (
                        <a
                          className="prj-file-chip"
                          href={req.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={req.documentOriginalName || undefined}
                        >
                          <FileMark />
                          Document
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="ui-empty prj-empty prj-empty--inset">
            <span className="ui-empty__mark">
              <CartMark />
            </span>
            <p className="ui-empty__title">No material requests yet</p>
            <p className="ui-empty__text">
              {isTL
                ? 'Ask central inventory for components; approvals land back here.'
                : 'Requests raised by the team leader appear here.'}
            </p>
            {isTL && (
              <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={openModal}>
                Request materials
              </button>
            )}
          </div>
        )}
      </div>

      {/* Request materials · team leader */}
      {isModalOpen &&
        createPortal(
          <div
            className="ui-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeModal();
            }}
          >
            <div
              className="ui-modal ui-modal--wide"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${fieldId}-title`}
            >
              <header className="ui-modal__head">
                <div>
                  <h2 className="ui-h2" id={`${fieldId}-title`}>
                    Request materials
                  </h2>
                </div>
                <button
                  type="button"
                  className="ui-icon-btn"
                  onClick={closeModal}
                  disabled={submitting}
                  aria-label="Close"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </button>
              </header>

              <form onSubmit={handleSubmit}>
                <div className="ui-modal__body ui-stack">
                  {submitError && (
                    <div className="ui-notice ui-notice--error" role="alert">
                      {submitError}
                    </div>
                  )}
                  {submitSuccess && (
                    <div className="ui-notice prj-notice--ok" role="status">
                      {submitSuccess}
                    </div>
                  )}

                  <div className="prj-lines">
                    {loadingInventory ? (
                      <span className="ui-skel" style={{ display: 'block', height: 40 }} />
                    ) : (
                      lines.map((line, index) => {
                        const item = itemById(line.itemId);
                        const max = item?.availableQuantity ?? 0;
                        const cost = item?.unitCost;
                        return (
                          <div className="prj-line" key={line.key}>
                            <div className="prj-line__head">
                              <span className="prj-line__no">Item {index + 1}</span>
                              {lines.length > 1 && (
                                <button
                                  type="button"
                                  className="ui-btn ui-btn--ghost ui-btn--sm"
                                  onClick={() => removeLine(line.key)}
                                  disabled={submitting}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            <label className="ui-label" htmlFor={`${fieldId}-item-${line.key}`}>
                              Material from central inventory
                            </label>
                            <Select
                              id={`${fieldId}-item-${line.key}`}
                              value={line.itemId}
                              onChange={(e) => updateLine(line.key, { itemId: e.target.value, quantity: 1 })}
                              required
                              disabled={submitting}
                            >
                              <option value="" disabled>
                                Choose an item
                              </option>
                              {inventoryItems.map((option) => (
                                <option key={option._id} value={option._id} disabled={option.availableQuantity <= 0}>
                                  {option.name}
                                  {option.category ? ` (${option.category})` : ''}
                                  {option.availableQuantity > 0
                                    ? ` · ${option.availableQuantity} available`
                                    : ' · Out of stock'}
                                </option>
                              ))}
                            </Select>

                            {item && (
                              <div className="prj-stock">
                                <div className="prj-stock__top">
                                  <span className={`ui-tag ${item.availableQuantity > 0 ? 'is-positive' : 'is-negative'}`}>
                                    {item.availableQuantity > 0
                                      ? `${item.availableQuantity} units available`
                                      : 'Out of stock'}
                                  </span>
                                  <span className="ui-meta">
                                    {cost === null || cost === undefined ? 'No price on file' : `${formatMoney(cost)} each`}
                                  </span>
                                  {item.location && <span className="ui-meta">{item.location}</span>}
                                </div>
                                {item.description && <p className="prj-stock__text">{item.description}</p>}
                              </div>
                            )}

                            <div className="ui-form-row ui-form-row--2">
                              <div>
                                <label className="ui-label" htmlFor={`${fieldId}-specs-${line.key}`}>
                                  Specifications <span className="prj-label__hint">optional</span>
                                </label>
                                <input
                                  id={`${fieldId}-specs-${line.key}`}
                                  type="text"
                                  className="ui-field"
                                  placeholder="e.g. 5V 2-channel relay module"
                                  value={line.specifications}
                                  onChange={(e) => updateLine(line.key, { specifications: e.target.value })}
                                  disabled={submitting}
                                />
                              </div>
                              <div>
                                <label className="ui-label" htmlFor={`${fieldId}-qty-${line.key}`}>
                                  Quantity
                                </label>
                                <input
                                  id={`${fieldId}-qty-${line.key}`}
                                  type="number"
                                  className="ui-field"
                                  min="1"
                                  max={max || 1}
                                  value={line.quantity}
                                  onChange={(e) =>
                                    updateLine(line.key, {
                                      quantity: e.target.value === '' ? '' : Math.max(1, Number(e.target.value)),
                                    })
                                  }
                                  required
                                  disabled={submitting}
                                />
                                {Number(line.quantity) > max && max > 0 && (
                                  <p className="ui-error">Requested quantity exceeds the {max} units in stock.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {!loadingInventory && inventoryItems.some((i) => i.availableQuantity > 0 && !lines.some((l) => l.itemId === i._id)) && (
                      <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={addLine} disabled={submitting}>
                        + Add another item
                      </button>
                    )}
                  </div>

                  {lines.length > 0 && (
                    <div className={`prj-route${goesToAdmin ? ' is-admin' : ''}`} role="status">
                      <p className="prj-route__total">
                        {pricing.unpriced ? 'Total not available' : `Estimated total ${formatMoney(pricing.total)}`}
                      </p>
                      <p className="prj-route__text">
                        {pricing.unpriced
                          ? 'At least one item has no price on file, so this goes to the project admin.'
                          : overBudget
                            ? `Above the ${formatMoney(budgetLimit)} limit, so this goes to the project admin and needs a full written justification.`
                            : `Within the ${formatMoney(budgetLimit)} limit, so this goes to your faculty mentor (if the project has one).`}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="ui-label" htmlFor={`${fieldId}-reason`}>
                      {needsLongReason ? 'Justification for the admin' : 'Reason'}{' '}
                      {needsLongReason && (
                        <span className="prj-label__hint">required · at least {minJustification} characters</span>
                      )}
                    </label>
                    <textarea
                      id={`${fieldId}-reason`}
                      className="ui-field ui-field--area"
                      rows={3}
                      placeholder={
                        needsLongReason
                          ? 'Explain what these materials are for, why they are needed now, and why the cost is justified.'
                          : 'What milestone or experiment needs this material?'
                      }
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      required
                      disabled={submitting}
                    />
                    {needsLongReason && (
                      <p className={reasonTooShort ? 'ui-error' : 'ui-meta'}>
                        {reason.trim().length}/{minJustification} characters
                      </p>
                    )}
                  </div>

                  <div className="ui-form-row ui-form-row--2">
                    <div>
                      <label className="ui-label" htmlFor={`${fieldId}-doc`}>
                        Document <span className="prj-label__hint">optional</span>
                      </label>
                      <input
                        id={`${fieldId}-doc`}
                        type="file"
                        className="prj-file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleDocumentChange}
                        disabled={submitting}
                      />
                      {documentFile && (
                        <div className="prj-file-chip prj-file-chip--selected">
                          <FileMark />
                          <span className="ui-truncate">{documentFile.name}</span>
                          <span className="ui-meta">{(documentFile.size / 1024).toFixed(1)} KB</span>
                          <button type="button" className="ui-icon-btn" onClick={() => setDocumentFile(null)} aria-label="Remove document">
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="ui-label" htmlFor={`${fieldId}-photo`}>
                        Reference photo <span className="prj-label__hint">optional</span>
                      </label>
                      <input
                        id={`${fieldId}-photo`}
                        type="file"
                        className="prj-file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageChange}
                        disabled={submitting}
                      />
                      {imagePreview && (
                        <div className="prj-attach">
                          <img src={imagePreview} alt="Component preview" />
                          <button
                            type="button"
                            className="ui-btn ui-btn--ghost ui-btn--sm"
                            onClick={() => {
                              setImageFile(null);
                              setImagePreview(null);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <footer className="ui-modal__foot">
                  <button type="button" className="ui-btn ui-btn--ghost" onClick={closeModal} disabled={submitting}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="ui-btn ui-btn--primary"
                    disabled={submitting || linesInvalid || duplicateItems}
                  >
                    {submitting ? 'Submitting…' : 'Submit request'}
                  </button>
                </footer>
              </form>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}

