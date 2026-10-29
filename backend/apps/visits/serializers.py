from rest_framework import serializers
from django.utils import timezone
from .models import (
    VisitLog,
    VisitStatus,
    FOLLOW_UP_REMARKS,
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
            'follow_up_remark', 'switching_reason', 'switching_to',
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
        raw_remark = (attrs.get('follow_up_remark') or '').strip()
        # Normalize dash variants and replacement characters
        norm_remark = (
            raw_remark
            .replace('—', '-')
            .replace('–', '-')
            .replace('\ufffd', '-')
        )

        matched_remark = None
        for r in FOLLOW_UP_REMARKS:
            if r.lower() == norm_remark.lower():
                matched_remark = r
                break

        if not matched_remark:
            raise serializers.ValidationError({
                'follow_up_remark': f"Invalid follow-up remark '{raw_remark}'. Please choose from standard list."
            })
        attrs['follow_up_remark'] = matched_remark

        raw_reason = (attrs.get('switching_reason') or '').strip()
        norm_reason = (
            raw_reason
            .replace('’', "'")
            .replace('‘', "'")
            .replace('\ufffd', "'")
        )
        if norm_reason:
            matched_reason = None
            for r in SWITCHING_REASONS:
                if r.lower() == norm_reason.lower():
                    matched_reason = r
                    break
            attrs['switching_reason'] = matched_reason if matched_reason else norm_reason
        else:
            attrs['switching_reason'] = ''

        switching_to = (attrs.get('switching_to') or '').strip()
        attrs['switching_to'] = switching_to

        # Normalize GPS coordinates to 7 decimal places for DecimalField storage
        if attrs.get('gps_latitude') is not None:
            attrs['gps_latitude'] = round(float(attrs['gps_latitude']), 7)
        if attrs.get('gps_longitude') is not None:
            attrs['gps_longitude'] = round(float(attrs['gps_longitude']), 7)

        # Rule: Switching To is required when remark is 'Switching to another ISP'
        if matched_remark == "Switching to another ISP":
            if not switching_to:
                raise serializers.ValidationError({
                    'switching_to': "Please select which ISP the customer is switching to."
                })
            if switching_to not in SWITCHING_TO_ISPS and switching_to != "Other / Unknown":
                raise serializers.ValidationError({
                    'switching_to': f"Invalid destination ISP '{switching_to}'."
                })

        # Rule: If customer is switching or reasons apply
        reasons_requiring_classification = [
            "Switching to another ISP",
            "Denied - Higher pricing than other ISPs",
            "Highly dissatisfied after price increment",
            "Denied - Poor service"
        ]
        if matched_remark in reasons_requiring_classification:
            if not attrs.get('switching_reason'):
                raise serializers.ValidationError({
                    'switching_reason': "Please specify the switching / churn reason."
                })
            if attrs['switching_reason'] not in SWITCHING_REASONS:
                raise serializers.ValidationError({
                    'switching_reason': f"Invalid switching reason '{attrs['switching_reason']}'."
                })

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
