// Hook untuk data profil user.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserProfile, updateUserProfile } from "../services/api.service";

// Ambil profil user saat ini.
export const useUserProfile = () => {
  return useQuery({
    queryKey: ["user", "profile"],
    queryFn: getUserProfile,
    staleTime: 5 * 60 * 1000, // Cache 5 menit.
  });
};

// Update profil user lalu refresh cache profil.
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => {
      // Invalidasi cache agar data profil terbaru diambil ulang.
      queryClient.invalidateQueries({ queryKey: ["user", "profile"] });
    },
  });
};
