/**
 * Hooks for User Profile using TanStack Query
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserProfile, updateUserProfile } from "../services/api.service";

// Get user profile
export const useUserProfile = () => {
  return useQuery({
    queryKey: ["user", "profile"],
    queryFn: getUserProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Update user profile
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => {
      // Invalidate and refetch user profile
      queryClient.invalidateQueries({ queryKey: ["user", "profile"] });
    },
  });
};
