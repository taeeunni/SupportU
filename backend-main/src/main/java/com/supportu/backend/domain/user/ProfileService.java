package com.supportu.backend.domain.user;

import com.supportu.backend.api.profile.ProfileRequest;
import com.supportu.backend.api.profile.ProfileResponse;
import com.supportu.backend.domain.orchestrator.OrchestratorAsyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final OrchestratorAsyncService orchestratorAsyncService;

    @Transactional
    public ProfileResponse getMyProfile(OAuth2User oauth2User) {
        String uid = getGoogleUid(oauth2User);
        String email = oauth2User.getAttribute("email");

        User user = userRepository.findById(uid)
                .map(existingUser -> {
                    existingUser.updateEmail(email);
                    return existingUser;
                })
                .orElseGet(() -> userRepository.save(new User(uid, email)));

        UserProfile profile = userProfileRepository.findById(user.getUid())
                .orElseGet(() -> userProfileRepository.save(new UserProfile(user.getUid())));

        return ProfileResponse.from(profile);
    }

    @Transactional
    public ProfileResponse updateMyProfile(OAuth2User oauth2User, ProfileRequest request) {
        String uid = getGoogleUid(oauth2User);
        String email = oauth2User.getAttribute("email");

        User user = userRepository.findById(uid)
                .map(existingUser -> {
                    existingUser.updateEmail(email);
                    return existingUser;
                })
                .orElseGet(() -> userRepository.save(new User(uid, email)));

        UserProfile profile = userProfileRepository.findById(user.getUid())
                .orElseGet(() -> userProfileRepository.save(new UserProfile(user.getUid())));

        profile.updateProfile(
                request.age(),
                request.gender(),
                request.city(),
                request.scity(),
                request.education(),
                request.employment(),
                request.disability(),
                request.incomeInteger(),
                request.asset(),
                request.preferredCategories()
        );

        orchestratorAsyncService.precomputeEligibility(user.getUid());

        return ProfileResponse.from(profile);
    }

    private String getGoogleUid(OAuth2User oauth2User) {
        String sub = oauth2User.getAttribute("sub");

        if (sub == null || sub.isBlank()) {
            throw new IllegalArgumentException("Google OAuth sub 값이 없습니다.");
        }

        return sub;
    }
}