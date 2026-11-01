from rest_framework import serializers
from django.utils import timezone
from .models import (
    VisitLog,
    VisitStatus,
    FOLLOW_UP_REMARKS,
    VISIT_REMARKS_STRUCTURE,
    ROUTER_COLLECTION_REMARKS_1,
    ROUTER_COLLECTION_ISPS,
    ROUTER_COLLECTION_SWITCHED_ISPS,
    ROUTER_COLLECTION_NOT_SWITCHED_ISPS,
    SWITCHING_REASONS,
    SWITCHING_TO_ISPS
)

class VisitLogSerializer(serializers.ModelSerializer):
    agent_name = serializers.ReadOnlyField(source='agent.full_name')
    agent_username = serializers.ReadOnlyField(source='agent.username')
    customer_code = serializers.ReadOnlyField(source='customer.customer_id')
    customer_name = serializers.ReadOnlyField(source='customer.customer_name')
    phone_number = serializers.ReadOnlyField(source='customer.phone_number')
    churn_days = serializers.ReadOnlyField(source='customer.churn_days')
    package = serializers.ReadOnlyField(source='customer.package')
    has_photo = serializers.SerializerMethodField()
    has_video = serializers.SerializerMethodField()

    class Meta:
        model = VisitLog
        fields = [
            'id', 'customer', 'customer_code', 'customer_name',
            'phone_number', 'churn_days', 'package', 'agent',
            'agent_name', 'agent_username', 'visit_status',
            'visit_category', 'follow_up_remark', 'switching_reason', 'switching_to',
            'notes', 'gps_latitude', 'gps_longitude', 'gps_accuracy',
            'gps_captured_at', 'completed_at', 'created_at',
            'has_photo', 'has_video'
        ]

    def get_has_photo(self, obj):
        return bool(obj.photo)

    def get_has_video(self, obj):
        return bool(obj.video)

class RecordVisitSerializer(serializers.Serializer):
    customer_id = serializers.CharField(required=True)
    visit_category = serializers.CharField(required=False, allow_blank=True)
    visit_status = serializers.ChoiceField(choices=VisitStatus.choices, default=VisitStatus.COMPLETED)
    follow_up_remark = serializers.CharField(required=True)
    switching_reason = serializers.CharField(required=False, allow_blank=True)
    switching_to = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    photo = serializers.ImageField(required=False, allow_null=True)
    video = serializers.FileField(required=False, allow_null=True)
    photo_evidence_id = serializers.IntegerField(required=False, allow_null=True)
    video_evidence_id = serializers.IntegerField(required=False, allow_null=True)

    # GPS info - FloatField accepts browser Geolocation API floats without precision crash
    gps_latitude = serializers.FloatField(required=False, allow_null=True)
    gps_longitude = serializers.FloatField(required=False, allow_null=True)
    gps_accuracy = serializers.FloatField(required=False, allow_null=True)

    # Optional scheduling
    follow_up_date = serializers.DateField(required=False, allow_null=True)
    follow_up_notes = serializers.CharField(required=False, allow_blank=True)

    def validate_photo(self, photo):
        if photo and photo.size > 10 * 1024 * 1024:
            raise serializers.ValidationError('Photo must be 10 MB or smaller.')
        return photo

    def validate_video(self, video):
        if not video:
            return video
        if video.size > 50 * 1024 * 1024:
            raise serializers.ValidationError('Video must be 50 MB or smaller.')
        extension = video.name.rsplit('.', 1)[-1].lower() if '.' in video.name else ''
        if extension not in {'mp4', 'mov', 'webm'}:
            raise serializers.ValidationError('Video must be an MP4, MOV, or WebM file.')
        if video.content_type and not video.content_type.startswith('video/'):
            raise serializers.ValidationError('Please upload a valid video file.')
        return video

    def validate(self, attrs):
        raw_category = (attrs.get('visit_category') or '').strip()
        if raw_category:
            category_matches = [config['category'] for config in VISIT_REMARKS_STRUCTURE if config['category'].lower() == raw_category.lower()]
            if not category_matches:
                raise serializers.ValidationError({
                    'visit_category': f"Invalid category '{raw_category}'."
                })
            attrs['visit_category'] = category_matches[0]
        else:
            raw_remark = (attrs.get('follow_up_remark') or '').strip()
            matched_category = None
            for config in VISIT_REMARKS_STRUCTURE:
                if any(r.lower() == raw_remark.lower() for r in config['remarks']):
                    matched_category = config['category']
                    break
            attrs['visit_category'] = matched_category or ''

        raw_remark = (attrs.get('follow_up_remark') or '').strip()
        norm_remark = (
            raw_remark
            .replace('—', '-')
            .replace('–', '-')
            .replace('\ufffd', '-')
        )

        matched_remark = None
        matched_category = None
        for config in VISIT_REMARKS_STRUCTURE:
            for r in config['remarks']:
                if r.lower() == norm_remark.lower():
                    matched_remark = r
                    matched_category = config['category']
                    break
            if matched_remark:
                break

        if not matched_remark:
            raise serializers.ValidationError({
                'follow_up_remark': f"Invalid follow-up remark '{raw_remark}'. Please choose from standard list."
            })

        attrs['follow_up_remark'] = matched_remark

        if attrs.get('visit_category') and attrs['visit_category'] and matched_category and attrs['visit_category'] != matched_category:
            raise serializers.ValidationError({
                'visit_category': f"Selected category '{attrs['visit_category']}' does not match remark '{matched_remark}'."
            })

        if attrs.get('visit_category'):
            attrs['visit_category'] = matched_category or attrs['visit_category']

        if attrs['visit_category'] == 'Router Collection':
            raw_reason = (attrs.get('switching_reason') or '').strip()
            if not raw_reason:
                raise serializers.ValidationError({
                    'switching_reason': 'Please select a router collection remarks option.'
                })
            if raw_reason not in ROUTER_COLLECTION_REMARKS_1:
                raise serializers.ValidationError({
                    'switching_reason': f"Invalid router collection remark '{raw_reason}'."
                })
            attrs['switching_reason'] = raw_reason

            switching_to = (attrs.get('switching_to') or '').strip()
            valid_isps = (
                ROUTER_COLLECTION_SWITCHED_ISPS
                if raw_reason == 'Switched to other ISP'
                else ROUTER_COLLECTION_NOT_SWITCHED_ISPS
            )
            if raw_reason == 'Switched to other ISP' and not switching_to:
                raise serializers.ValidationError({
                    'switching_to': 'Please select the ISP for this router collection record.'
                })
            if switching_to and switching_to not in valid_isps:
                raise serializers.ValidationError({
                    'switching_to': f"Invalid ISP '{switching_to}' for router collection remark '{raw_reason}'."
                })
            attrs['switching_to'] = switching_to
        else:
            attrs['switching_reason'] = (attrs.get('switching_reason') or '').strip()
            attrs['switching_to'] = (attrs.get('switching_to') or '').strip()

        if attrs.get('gps_latitude') is not None:
            attrs['gps_latitude'] = round(float(attrs['gps_latitude']), 7)
        if attrs.get('gps_longitude') is not None:
            attrs['gps_longitude'] = round(float(attrs['gps_longitude']), 7)

        return attrs


class VisitEvidenceUploadSerializer(serializers.Serializer):
    customer_id = serializers.CharField(required=True)
    photo = serializers.ImageField(required=False)
    video = serializers.FileField(required=False)

    def validate(self, attrs):
        if bool(attrs.get('photo')) == bool(attrs.get('video')):
            raise serializers.ValidationError('Upload exactly one photo or video.')
        return attrs

    def validate_photo(self, photo):
        if photo.size > 10 * 1024 * 1024:
            raise serializers.ValidationError('Photo must be 10 MB or smaller.')
        return photo

    def validate_video(self, video):
        if video.size > 50 * 1024 * 1024:
            raise serializers.ValidationError('Video must be 50 MB or smaller.')
        extension = video.name.rsplit('.', 1)[-1].lower() if '.' in video.name else ''
        if extension not in {'mp4', 'mov', 'webm'}:
            raise serializers.ValidationError('Video must be an MP4, MOV, or WebM file.')
        if video.content_type and not video.content_type.startswith('video/'):
            raise serializers.ValidationError('Please upload a valid video file.')
        return video
