'use client';

import { Badge, PopulatedBadge } from '@/types';
import { notFound, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import SubmissionForm from '@/components/submissions/SubmissionForm';
import MainLayout from '@/components/layout/MainLayout';
import { toast } from 'react-hot-toast';
import { Session } from 'next-auth';

interface ExtendedSession extends Session {
  user: {
    email: string;
    role: string;
  } & Session['user'];
}

interface BadgeCreator {
  _id: string;
  email: string;
  name?: string;
}

type PopulatedBadgeWithCreator = Omit<PopulatedBadge, 'creatorId'> & {
  creatorId: BadgeCreator;
};

export default function BadgePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: session } = useSession() as { data: ExtendedSession | null };
  const [badge, setBadge] = useState<PopulatedBadgeWithCreator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasEarnedBadge, setHasEarnedBadge] = useState(false);
  const [hasPendingSubmission, setHasPendingSubmission] = useState(false);

  const isTeacherOrAdmin = session?.user?.role === 'teacher' || session?.user?.role === 'admin';
  const isCreator = badge?.creatorId?.email === session?.user?.email;
  const isAdmin = session?.user?.role === 'admin';
  const canModify = (isTeacherOrAdmin && isCreator) || isAdmin;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this badge? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/badges/${params.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete badge');
      }

      toast.success('Badge deleted successfully');
      router.push('/badges');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete badge');
      setIsDeleting(false);
    }
  };

  const toggleVisibility = async () => {
    if (!badge) return;
    
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/badges/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...badge,
          isPublic: !badge.isPublic,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update badge visibility');
      }

      const updatedBadge = await res.json();
      setBadge(updatedBadge);
      toast.success(`Badge is now ${updatedBadge.isPublic ? 'public' : 'private'}`);
    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update badge visibility');
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [badgeRes, submissionsRes] = await Promise.all([
          fetch(`/api/badges/${params.id}`),
          (session?.user as any)?.role === 'student' ? fetch('/api/submissions') : null
        ]);

        if (!badgeRes.ok) {
          throw new Error('Failed to fetch badge');
        }

        const badgeData = await badgeRes.json();
        setBadge(badgeData);

        if (submissionsRes) {
          const submissionsData = await submissionsRes.json();
          // Check if student has already earned this badge
          const hasEarned = submissionsData.some(
            (s: any) => s?.badgeId && typeof s.badgeId === 'object' && '_id' in s.badgeId && s.badgeId._id === params.id && s.status === 'approved'
          );
          
          // Check if student has a pending submission for this badge
          const hasPending = submissionsData.some(
            (s: any) => s?.badgeId && typeof s.badgeId === 'object' && '_id' in s.badgeId && s.badgeId._id === params.id && s.status === 'pending'
          );
          
          setHasEarnedBadge(hasEarned);
          setHasPendingSubmission(hasPending);
        }
      } catch (error) {
        console.error('Error:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchData();
    }
  }, [params.id, session]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    );
  }

  if (error || !badge) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-red-600 dark:text-red-400">Error</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error || 'Badge not found'}</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{badge.name}</h1>
                  <div className="mt-2 flex items-center space-x-2">
                    <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium ${
                      badge.isPublic 
                        ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {badge.isPublic ? 'Public' : 'Private'}
                    </span>
                    {canModify && (
                      <button
                        onClick={toggleVisibility}
                        disabled={isUpdating}
                        className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-700"
                      >
                        {isUpdating ? 'Updating...' : `Make ${badge.isPublic ? 'Private' : 'Public'}`}
                      </button>
                    )}
                  </div>
                </div>
                {canModify && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => router.push(`/badges/${params.id}/edit`)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Edit Badge
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete Badge'}
                    </button>
                  </div>
                )}
              </div>
              {badge.image && (
                <div className="mt-4">
                  <img
                    src={badge.image}
                    alt={badge.name}
                    className="w-32 h-32 object-cover rounded-lg shadow-md"
                  />
                </div>
              )}
              <div className="mt-4 flex items-center">
                <div className="flex">
                  {Array(5)
                    .fill(0)
                    .map((_, i) => (
                      <svg
                        key={`star-${i}`}
                        className={`h-6 w-6 ${
                          i < badge.difficulty ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                </div>
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  Difficulty Level: {badge.difficulty}/5
                </span>
              </div>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-300">{badge.description}</dd>
                </div>

                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Category</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-300">
                    {badge.category && typeof badge.category === 'object' && badge.category.name ? (
                      <span 
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium shadow-sm"
                        style={{ 
                          backgroundColor: badge.category.color || 'gray',
                          color: '#ffffff',
                          fontWeight: '500',
                        }}
                      >
                        {badge.category.name}
                      </span>
                    ) : (
                      <span 
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium shadow-sm"
                        style={{ 
                          backgroundColor: 'rgb(156, 163, 175)',
                          color: '#ffffff',
                          fontWeight: '500',
                        }}
                      >
                        {typeof badge.category === 'string' ? badge.category : 'Uncategorized'}
                      </span>
                    )}
                  </dd>
                </div>

                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created By</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-300">
                    {badge.creatorId.name || badge.creatorId.email}
                  </dd>
                </div>

                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Criteria</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-300">{badge.criteria}</dd>
                </div>
              </dl>
            </div>
            
            {/* Submission Section */}
            {session?.user?.role === 'student' && (
              <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6">
                <div className="space-y-4">
                  {hasEarnedBadge ? (
                    <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-green-700 dark:text-green-200">
                            Congratulations! You've earned this badge.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : hasPendingSubmission ? (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-yellow-700 dark:text-yellow-200">
                            Your submission for this badge is currently being reviewed.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                        Ready to Earn This Badge?
                      </h3>
                      <div className="bg-white dark:bg-gray-800">
                        <SubmissionForm 
                          badge={{
                            ...badge,
                            category: typeof badge.category === 'object' ? (badge.category._id || '') : badge.category,
                            creatorId: typeof badge.creatorId === 'object' ? badge.creatorId._id : badge.creatorId
                          }} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </MainLayout>
  );
} 