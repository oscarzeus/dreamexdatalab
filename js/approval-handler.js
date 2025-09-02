export function checkApproverStatus(currentUser, trainingRequest) {
    const approvalButtons = document.getElementById('approvalButtons');
    
    // Hide approval buttons by default
    approvalButtons.style.display = 'none';

    if (!currentUser || !trainingRequest) return;

    // Get current approval level
    const currentLevel = trainingRequest.approvalFlow.find(level => 
        level.status === 'pending'
    );

    if (!currentLevel) return;

    // Check if current user is an approver at the current level
    const isApprover = currentLevel.approvers.some(approver => 
        approver.uid === currentUser.uid
    );

    // Show approval buttons only if user is an approver at the current level
    if (isApprover) {
        approvalButtons.style.display = 'inline-flex';
    }
}
