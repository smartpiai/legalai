import React, { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ArchiveBoxIcon, 
  TrashIcon,
  ArrowDownTrayIcon,
  TagIcon,
  UserPlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../store/auth';
import api from '../../services/api';

interface BulkOperationsBarProps {
  selectedIds: number[];
  onSuccess: () => void;
  onCancel: () => void;
}

interface User {
  id: number;
  name: string;
  email: string;
}

type ExportFormat = 'pdf' | 'excel' | 'csv' | 'json';

export const BulkOperationsBar: React.FC<BulkOperationsBarProps> = ({
  selectedIds,
  onSuccess,
  onCancel,
}) => {
  const { hasPermission } = useAuthStore();
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  
  const [rejectReason, setRejectReason] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [tags, setTags] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch users for assignment
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/api/v1/users');
      return response.data;
    },
    enabled: showAssignDialog,
  });

  // Bulk approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/v1/contracts/bulk/approve', {
        contract_ids: selectedIds,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully approved ${data.updated} contracts`);
      setShowApproveDialog(false);
      onSuccess();
    },
    onError: () => {
      toast.error('Failed to approve contracts');
    },
  });

  // Bulk reject mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/v1/contracts/bulk/reject', {
        contract_ids: selectedIds,
        reason: rejectReason,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully rejected ${data.updated} contracts`);
      setShowRejectDialog(false);
      setRejectReason('');
      onSuccess();
    },
    onError: () => {
      toast.error('Failed to reject contracts');
    },
  });

  // Bulk archive mutation
  const archiveMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/v1/contracts/bulk/archive', {
        contract_ids: selectedIds,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully archived ${data.updated} contracts`);
      onSuccess();
    },
    onError: () => {
      toast.error('Failed to archive contracts');
    },
  });

  // Bulk delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete('/api/v1/contracts/bulk', {
        data: { contract_ids: selectedIds },
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully deleted ${data.deleted} contracts`);
      setShowDeleteDialog(false);
      setDeleteConfirmText('');
      onSuccess();
    },
    onError: () => {
      toast.error('Failed to delete contracts');
    },
  });

  // Bulk export mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(
        '/api/v1/contracts/bulk/export',
        {
          contract_ids: selectedIds,
          format: exportFormat,
        },
        { responseType: 'blob' }
      );
      return response.data;
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contracts_export_${Date.now()}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Export completed successfully');
      setShowExportDialog(false);
      onSuccess();
    },
    onError: () => {
      toast.error('Failed to export contracts');
    },
  });

  // Bulk tag mutation
  const tagMutation = useMutation({
    mutationFn: async () => {
      const tagArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);
      const response = await api.post('/api/v1/contracts/bulk/tag', {
        contract_ids: selectedIds,
        tags: tagArray,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully tagged ${data.updated} contracts`);
      setShowTagDialog(false);
      setTags('');
      onSuccess();
    },
    onError: () => {
      toast.error('Failed to tag contracts');
    },
  });

  // Bulk assign mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/v1/contracts/bulk/assign', {
        contract_ids: selectedIds,
        user_id: selectedUserId,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully assigned ${data.updated} contracts`);
      setShowAssignDialog(false);
      setSelectedUserId(null);
      onSuccess();
    },
    onError: () => {
      toast.error('Failed to assign contracts');
    },
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'a':
            e.preventDefault();
            setShowApproveDialog(true);
            break;
          case 'd':
            e.preventDefault();
            setShowDeleteDialog(true);
            break;
          case 'e':
            e.preventDefault();
            setShowExportDialog(true);
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleApprove = useCallback(() => {
    setIsProcessing(true);
    approveMutation.mutate();
  }, [approveMutation]);

  const handleReject = useCallback(() => {
    setIsProcessing(true);
    rejectMutation.mutate();
  }, [rejectMutation]);

  const handleArchive = useCallback(() => {
    archiveMutation.mutate();
  }, [archiveMutation]);

  const handleDelete = useCallback(() => {
    setIsProcessing(true);
    deleteMutation.mutate();
  }, [deleteMutation]);

  const handleExport = useCallback(() => {
    exportMutation.mutate();
  }, [exportMutation, exportFormat]);

  const handleTag = useCallback(() => {
    tagMutation.mutate();
  }, [tagMutation, tags]);

  const handleAssign = useCallback(() => {
    assignMutation.mutate();
  }, [assignMutation, selectedUserId]);

  const contractText = selectedIds.length === 1 ? 'contract' : 'contracts';

  return (
    <>
      <div 
        role="toolbar" 
        aria-label="Bulk operations toolbar"
        className="bg-white border rounded-lg shadow-sm p-4 mb-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span role="status" className="text-sm font-medium text-gray-700">
              {selectedIds.length} {contractText} selected
            </span>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowApproveDialog(true)}
                disabled={!hasPermission('contract.approve')}
                className="flex items-center"
              >
                <CheckCircleIcon className="h-4 w-4 mr-1" />
                Approve
              </Button>
              
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowRejectDialog(true)}
                disabled={!hasPermission('contract.approve')}
                className="flex items-center"
              >
                <XCircleIcon className="h-4 w-4 mr-1" />
                Reject
              </Button>
              
              <Button
                variant="secondary"
                size="sm"
                onClick={handleArchive}
                disabled={!hasPermission('contract.edit')}
                className="flex items-center"
              >
                <ArchiveBoxIcon className="h-4 w-4 mr-1" />
                Archive
              </Button>
              
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={!hasPermission('contract.delete')}
                className="flex items-center"
              >
                <TrashIcon className="h-4 w-4 mr-1" />
                Delete
              </Button>
              
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowExportDialog(true)}
                className="flex items-center"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                Export
              </Button>
              
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowTagDialog(true)}
                disabled={!hasPermission('contract.edit')}
                className="flex items-center"
              >
                <TagIcon className="h-4 w-4 mr-1" />
                Tag
              </Button>
              
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAssignDialog(true)}
                disabled={!hasPermission('contract.edit')}
                className="flex items-center"
              >
                <UserPlusIcon className="h-4 w-4 mr-1" />
                Assign
              </Button>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="flex items-center"
          >
            <XMarkIcon className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>
      </div>

      {/* Approve Dialog */}
      {showApproveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Bulk Approval</h3>
            <p className="mb-4">Are you sure you want to approve {selectedIds.length} {contractText}?</p>
            {isProcessing && <p className="text-sm text-gray-500 mb-4">Processing...</p>}
            <div className="flex justify-end space-x-2">
              <Button variant="secondary" onClick={() => setShowApproveDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleApprove} disabled={isProcessing}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Reject Contracts</h3>
            <div className="mb-4">
              <label htmlFor="reject-reason" className="block text-sm font-medium mb-2">
                Rejection Reason
              </label>
              <textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full border rounded-lg p-2"
                rows={3}
                placeholder="Enter reason for rejection..."
              />
            </div>
            {isProcessing && <p className="text-sm text-gray-500 mb-4">Processing...</p>}
            <div className="flex justify-end space-x-2">
              <Button variant="secondary" onClick={() => setShowRejectDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleReject} disabled={!rejectReason || isProcessing}>
                Reject Contracts
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Deletion</h3>
            <p className="mb-2 text-red-600">This action cannot be undone!</p>
            <p className="mb-4">Are you sure you want to delete {selectedIds.length} {contractText}?</p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full border rounded-lg p-2 mb-4"
            />
            {isProcessing && <p className="text-sm text-gray-500 mb-4">Processing...</p>}
            <div className="flex justify-end space-x-2">
              <Button variant="secondary" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="danger" 
                onClick={handleDelete} 
                disabled={deleteConfirmText !== 'DELETE' || isProcessing}
              >
                Delete Contracts
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Export Contracts</h3>
            <div className="space-y-2 mb-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="format"
                  value="pdf"
                  checked={exportFormat === 'pdf'}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  className="mr-2"
                />
                PDF
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="format"
                  value="excel"
                  checked={exportFormat === 'excel'}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  className="mr-2"
                />
                Excel
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={exportFormat === 'csv'}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  className="mr-2"
                />
                CSV
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={exportFormat === 'json'}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  className="mr-2"
                />
                JSON
              </label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="secondary" onClick={() => setShowExportDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleExport}>
                Export
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Dialog */}
      {showTagDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add Tags</h3>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Enter tags separated by commas"
              className="w-full border rounded-lg p-2 mb-4"
            />
            <div className="flex justify-end space-x-2">
              <Button variant="secondary" onClick={() => setShowTagDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleTag} disabled={!tags}>
                Add Tags
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Dialog */}
      {showAssignDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Assign Contracts</h3>
            <div className="mb-4">
              <label htmlFor="user-select" className="block text-sm font-medium mb-2">
                Select User
              </label>
              <select
                id="user-select"
                value={selectedUserId || ''}
                onChange={(e) => setSelectedUserId(Number(e.target.value))}
                className="w-full border rounded-lg p-2"
              >
                <option value="">Select a user...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="secondary" onClick={() => setShowAssignDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssign} disabled={!selectedUserId}>
                Assign
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Screen reader announcements */}
      {(approveMutation.isSuccess || rejectMutation.isSuccess || archiveMutation.isSuccess || 
        deleteMutation.isSuccess || exportMutation.isSuccess || tagMutation.isSuccess || 
        assignMutation.isSuccess) && (
        <div role="alert" className="sr-only">
          {approveMutation.isSuccess && `Successfully approved ${selectedIds.length} contracts`}
          {rejectMutation.isSuccess && `Successfully rejected ${selectedIds.length} contracts`}
          {archiveMutation.isSuccess && `Successfully archived ${selectedIds.length} contracts`}
          {deleteMutation.isSuccess && `Successfully deleted ${selectedIds.length} contracts`}
          {exportMutation.isSuccess && 'Export completed successfully'}
          {tagMutation.isSuccess && `Successfully tagged ${selectedIds.length} contracts`}
          {assignMutation.isSuccess && `Successfully assigned ${selectedIds.length} contracts`}
        </div>
      )}
    </>
  );
};
