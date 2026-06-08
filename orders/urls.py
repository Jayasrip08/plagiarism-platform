from django.urls import path
from .views import (
    WordCountEstimateView,
    OrderListCreateView,
    OrderDetailView,
    AddEditingSuggestionsView,
    DownloadReportView,
    OrderInvoiceView,
    SuperAdminOrderQueueView,
    SuperAdminUpdateOrderView,
    PricingConfigView
)

urlpatterns = [
    path('estimate/', WordCountEstimateView.as_view(), name='word_count_estimate'),
    path('', OrderListCreateView.as_view(), name='order_list_create'),
    path('<int:pk>/', OrderDetailView.as_view(), name='order_detail'),
    path('<int:pk>/add-editing-suggestions/', AddEditingSuggestionsView.as_view(), name='add_editing_suggestions'),
    path('<int:pk>/download-report/', DownloadReportView.as_view(), name='download_report'),
    path('<int:pk>/invoice/', OrderInvoiceView.as_view(), name='order_invoice'),
    
    # Super Admin routes
    path('super/queue/', SuperAdminOrderQueueView.as_view(), name='super_order_queue'),
    path('super/<int:pk>/update/', SuperAdminUpdateOrderView.as_view(), name='super_order_update'),
    path('pricing/', PricingConfigView.as_view(), name='pricing_config'),
]
