"""
Hierarchical Reasoning Model Implementation
Based on the paper's architecture
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, List, Tuple, Optional

class HierarchicalReasoningModel(nn.Module):
    """
    HRM implementation for legal reasoning
    """
    def __init__(
        self,
        input_dim: int = 768,
        hidden_dim: int = 512,
        n_high_cycles: int = 4,
        n_low_steps: int = 8
    ):
        super().__init__()
        
        self.n_high_cycles = n_high_cycles
        self.n_low_steps = n_low_steps
        
        # High-level module (strategic planning)
        self.high_level = nn.TransformerEncoder(
            nn.TransformerEncoderLayer(
                d_model=hidden_dim,
                nhead=8,
                dim_feedforward=2048,
                dropout=0.1
            ),
            num_layers=4
        )
        
        # Low-level module (detailed execution)
        self.low_level = nn.TransformerEncoder(
            nn.TransformerEncoderLayer(
                d_model=hidden_dim,
                nhead=8,
                dim_feedforward=2048,
                dropout=0.1
            ),
            num_layers=2
        )
        
        # Input projection
        self.input_projection = nn.Linear(input_dim, hidden_dim)
        
        # Output projection
        self.output_projection = nn.Linear(hidden_dim, input_dim)
        
    def forward(
        self,
        x: torch.Tensor,
        context: Optional[torch.Tensor] = None
    ) -> Tuple[torch.Tensor, Dict[str, torch.Tensor]]:
        """
        Forward pass implementing hierarchical reasoning
        
        Args:
            x: Input tensor (batch_size, seq_len, input_dim)
            context: Optional context tensor
            
        Returns:
            output: Final reasoning output
            intermediates: Dictionary of intermediate states
        """
        batch_size, seq_len, _ = x.shape
        
        # Project input
        x = self.input_projection(x)
        
        # Initialize states
        z_h = torch.zeros(batch_size, seq_len, x.shape[-1]).to(x.device)
        z_l = torch.zeros(batch_size, seq_len, x.shape[-1]).to(x.device)
        
        intermediates = {
            'high_level_states': [],
            'low_level_states': []
        }
        
        # Hierarchical reasoning loop
        for cycle in range(self.n_high_cycles):
            # Low-level processing (multiple steps)
            for step in range(self.n_low_steps):
                # Combine with high-level state
                l_input = z_l + z_h + x
                
                # Low-level update
                z_l = self.low_level(l_input)
                intermediates['low_level_states'].append(z_l)
                
            # High-level update (once per cycle)
            h_input = z_h + z_l
            z_h = self.high_level(h_input)
            intermediates['high_level_states'].append(z_h)
            
            # Reset low-level for next cycle
            z_l = torch.zeros_like(z_l)
            
        # Generate output
        output = self.output_projection(z_h)
        
        return output, intermediates
    
    def reason_about_contract(
        self,
        contract_embedding: torch.Tensor,
        query: torch.Tensor
    ) -> Dict[str, torch.Tensor]:
        """
        Perform legal reasoning about a contract
        """
        # Combine contract and query
        combined = torch.cat([contract_embedding, query], dim=1)
        
        # Run reasoning
        output, intermediates = self.forward(combined)
        
        # Extract reasoning components
        reasoning = {
            'strategic_assessment': output[:, :output.shape[1]//2],
            'detailed_analysis': output[:, output.shape[1]//2:],
            'confidence': torch.sigmoid(output.mean(dim=1))
        }
        
        return reasoning
