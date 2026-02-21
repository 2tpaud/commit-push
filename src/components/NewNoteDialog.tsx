'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import { getLimitsForPlan } from '../lib/planLimits'
import type { User } from '@supabase/supabase-js'
import RelatedNoteSearchDialog from './RelatedNoteSearchDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { X } from 'lucide-react'

interface Note {
  id: string
  title: string
  category_large: string | null
  category_medium: string | null
  category_small: string | null
  tags: string[] | null
}

interface NewNoteDialogProps {
  user: User
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  noteId?: string // 수정 모드일 때 노트 ID
}

export default function NewNoteDialog({
  user,
  isOpen,
  onClose,
  onSuccess,
  noteId,
}: NewNoteDialogProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  // 폼 데이터
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryLarge, setCategoryLarge] = useState('')
  const [categoryMedium, setCategoryMedium] = useState('')
  const [categorySmall, setCategorySmall] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [relatedNoteIds, setRelatedNoteIds] = useState<string[]>([])
  const [relatedNoteInput, setRelatedNoteInput] = useState('')

  // 드롭다운 옵션 데이터
  const [existingNotes, setExistingNotes] = useState<Note[]>([])
  const [allCategoryLarge, setAllCategoryLarge] = useState<string[]>([])
  const [allCategoryMedium, setAllCategoryMedium] = useState<string[]>([])
  const [allCategorySmall, setAllCategorySmall] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])

  // 자동완성 필터링
  const [filteredCategoryLarge, setFilteredCategoryLarge] = useState<string[]>([])
  const [filteredCategoryMedium, setFilteredCategoryMedium] = useState<string[]>([])
  const [filteredCategorySmall, setFilteredCategorySmall] = useState<string[]>([])
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([])
  const [filteredTags, setFilteredTags] = useState<string[]>([])
  const [showCategoryLargeDropdown, setShowCategoryLargeDropdown] = useState(false)
  const [showCategoryMediumDropdown, setShowCategoryMediumDropdown] = useState(false)
  const [showCategorySmallDropdown, setShowCategorySmallDropdown] = useState(false)
  const [showNotesDropdown, setShowNotesDropdown] = useState(false)
  const [showTagsDropdown, setShowTagsDropdown] = useState(false)
  const [showRelatedNoteSearchDialog, setShowRelatedNoteSearchDialog] = useState(false)

  // 키보드 네비게이션 인덱스
  const [selectedCategoryLargeIndex, setSelectedCategoryLargeIndex] = useState(-1)
  const [selectedCategoryMediumIndex, setSelectedCategoryMediumIndex] = useState(-1)
  const [selectedCategorySmallIndex, setSelectedCategorySmallIndex] = useState(-1)
  const [selectedTagIndex, setSelectedTagIndex] = useState(-1)
  const [selectedNoteIndex, setSelectedNoteIndex] = useState(-1)

  const categoryLargeRef = useRef<HTMLDivElement>(null)
  const categoryMediumRef = useRef<HTMLDivElement>(null)
  const categorySmallRef = useRef<HTMLDivElement>(null)
  const notesRef = useRef<HTMLDivElement>(null)
  const tagsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && user) {
      loadExistingData(user.id)
      if (noteId) {
        loadNoteData(noteId)
      } else {
        // 새 노트 모드일 때 폼 리셋
        setTitle('')
        setDescription('')
        setCategoryLarge('')
        setCategoryMedium('')
        setCategorySmall('')
        setTags([])
        setTagInput('')
        setRelatedNoteIds([])
        setRelatedNoteInput('')
      }
    }
  }, [isOpen, user, noteId])

  const loadNoteData = async (id: string) => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error loading note:', error)
      return
    }

    if (data) {
      setTitle(data.title || '')
      setDescription(data.description || '')
      setCategoryLarge(data.category_large || '')
      setCategoryMedium(data.category_medium || '')
      setCategorySmall(data.category_small || '')
      setTags(data.tags || [])
      setRelatedNoteIds(data.related_note_ids || [])
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryLargeRef.current &&
        !categoryLargeRef.current.contains(event.target as Node)
      ) {
        setShowCategoryLargeDropdown(false)
      }
      if (
        categoryMediumRef.current &&
        !categoryMediumRef.current.contains(event.target as Node)
      ) {
        setShowCategoryMediumDropdown(false)
      }
      if (
        categorySmallRef.current &&
        !categorySmallRef.current.contains(event.target as Node)
      ) {
        setShowCategorySmallDropdown(false)
      }
      if (
        notesRef.current &&
        !notesRef.current.contains(event.target as Node)
      ) {
        setShowNotesDropdown(false)
      }
      if (
        tagsRef.current &&
        !tagsRef.current.contains(event.target as Node)
      ) {
        setShowTagsDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadExistingData = async (userId: string) => {
    const { data, error } = await supabase
      .from('notes')
      .select('id, title, category_large, category_medium, category_small, tags')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading notes:', error)
      return
    }

    if (data) {
      setExistingNotes(data)

      const largeSet = new Set<string>()
      const mediumSet = new Set<string>()
      const smallSet = new Set<string>()
      const tagsSet = new Set<string>()

      data.forEach((note) => {
        if (note.category_large) largeSet.add(note.category_large)
        if (note.category_medium) mediumSet.add(note.category_medium)
        if (note.category_small) smallSet.add(note.category_small)
        if (note.tags && note.tags.length > 0) {
          note.tags.forEach((tag: string) => tagsSet.add(tag))
        }
      })

      setAllCategoryLarge(Array.from(largeSet).sort())
      setAllCategoryMedium(Array.from(mediumSet).sort())
      setAllCategorySmall(Array.from(smallSet).sort())
      setAllTags(Array.from(tagsSet).sort())
    }
  }

  // 대분류 필터링
  useEffect(() => {
    if (categoryLarge) {
      // 입력값이 정확히 일치하는 항목이 있으면 드롭다운을 열지 않음
      const exactMatch = allCategoryLarge.some(
        (cat) => cat.toLowerCase() === categoryLarge.toLowerCase()
      )
      if (exactMatch) {
        setFilteredCategoryLarge([])
        setShowCategoryLargeDropdown(false)
        setSelectedCategoryLargeIndex(-1)
        return
      }

      const filtered = allCategoryLarge.filter((cat) =>
        cat.toLowerCase().includes(categoryLarge.toLowerCase())
      )
      setFilteredCategoryLarge(filtered)
      // 입력값이 있을 때만 드롭다운 자동 열기 (키보드로 열 때는 핸들러에서 처리)
      if (categoryLarge.length > 0 && filtered.length > 0) {
        setShowCategoryLargeDropdown(true)
      }
      // 키보드 선택 인덱스는 리셋하지 않음 (키보드 네비게이션 유지)
    }
    // 입력값이 없을 때는 필터링만 비움 (드롭다운 상태는 유지)
  }, [categoryLarge, allCategoryLarge])

  // 중분류 필터링 (대분류 선택 시)
  useEffect(() => {
    if (categoryLarge) {
      const mediumOptions = existingNotes
        .filter((n) => n.category_large === categoryLarge && n.category_medium)
        .map((n) => n.category_medium!)
      const uniqueMedium = Array.from(new Set(mediumOptions)).sort()

      if (categoryMedium) {
        // 입력값이 정확히 일치하는 항목이 있으면 드롭다운을 열지 않음
        const exactMatch = uniqueMedium.some(
          (cat) => cat.toLowerCase() === categoryMedium.toLowerCase()
        )
        if (exactMatch) {
          setFilteredCategoryMedium([])
          setShowCategoryMediumDropdown(false)
          setSelectedCategoryMediumIndex(-1)
          return
        }

        const filtered = uniqueMedium.filter((cat) =>
          cat.toLowerCase().includes(categoryMedium.toLowerCase())
        )
        setFilteredCategoryMedium(filtered)
        setShowCategoryMediumDropdown(filtered.length > 0 && categoryMedium.length > 0)
        setSelectedCategoryMediumIndex(-1)
      } else {
        setFilteredCategoryMedium(uniqueMedium)
        setShowCategoryMediumDropdown(false)
        setSelectedCategoryMediumIndex(-1)
      }
    } else {
      setFilteredCategoryMedium([])
      setShowCategoryMediumDropdown(false)
      setCategoryMedium('')
    }
  }, [categoryLarge, categoryMedium, existingNotes])

  // 소분류 필터링 (중분류 선택 시)
  useEffect(() => {
    if (categoryMedium) {
      const smallOptions = existingNotes
        .filter(
          (n) =>
            n.category_large === categoryLarge &&
            n.category_medium === categoryMedium &&
            n.category_small
        )
        .map((n) => n.category_small!)
      const uniqueSmall = Array.from(new Set(smallOptions)).sort()

      if (categorySmall) {
        // 입력값이 정확히 일치하는 항목이 있으면 드롭다운을 열지 않음
        const exactMatch = uniqueSmall.some(
          (cat) => cat.toLowerCase() === categorySmall.toLowerCase()
        )
        if (exactMatch) {
          setFilteredCategorySmall([])
          setShowCategorySmallDropdown(false)
          setSelectedCategorySmallIndex(-1)
          return
        }

        const filtered = uniqueSmall.filter((cat) =>
          cat.toLowerCase().includes(categorySmall.toLowerCase())
        )
        setFilteredCategorySmall(filtered)
        setShowCategorySmallDropdown(filtered.length > 0 && categorySmall.length > 0)
        setSelectedCategorySmallIndex(-1)
      } else {
        setFilteredCategorySmall(uniqueSmall)
        setShowCategorySmallDropdown(false)
        setSelectedCategorySmallIndex(-1)
      }
    } else {
      setFilteredCategorySmall([])
      setShowCategorySmallDropdown(false)
      setCategorySmall('')
    }
  }, [categoryLarge, categoryMedium, categorySmall, existingNotes])

  // 연관 노트 필터링
  useEffect(() => {
    if (relatedNoteInput) {
      // 입력값이 정확히 일치하는 노트가 있고 이미 추가되지 않았으면 드롭다운을 열지 않음
      const exactMatch = existingNotes.find(
        (note) =>
          note.title.toLowerCase() === relatedNoteInput.toLowerCase() &&
          !relatedNoteIds.includes(note.id)
      )
      if (exactMatch) {
        setFilteredNotes([])
        setShowNotesDropdown(false)
        setSelectedNoteIndex(-1)
        return
      }

      const filtered = existingNotes.filter(
        (note) =>
          note.title.toLowerCase().includes(relatedNoteInput.toLowerCase()) &&
          !relatedNoteIds.includes(note.id)
      )
      setFilteredNotes(filtered)
      setShowNotesDropdown(filtered.length > 0)
      setSelectedNoteIndex(-1)
    } else {
      setFilteredNotes([])
      setShowNotesDropdown(false)
      setSelectedNoteIndex(-1)
    }
  }, [relatedNoteInput, existingNotes, relatedNoteIds])

  // 태그 필터링
  useEffect(() => {
    if (tagInput && !tagInput.includes(',')) {
      const currentTag = tagInput.trim().toLowerCase()
      
      // 입력값이 정확히 일치하는 태그가 있고 이미 추가되지 않았으면 드롭다운을 열지 않음
      const exactMatch = allTags.some(
        (tag) => tag.toLowerCase() === currentTag && !tags.includes(tag)
      )
      if (exactMatch && currentTag.length > 0) {
        setFilteredTags([])
        setShowTagsDropdown(false)
        setSelectedTagIndex(-1)
        return
      }

      const filtered = allTags.filter(
        (tag) =>
          tag.toLowerCase().includes(currentTag) && !tags.includes(tag)
      )
      setFilteredTags(filtered)
      setShowTagsDropdown(filtered.length > 0)
      setSelectedTagIndex(-1)
    } else {
      setFilteredTags([])
      setShowTagsDropdown(false)
      setSelectedTagIndex(-1)
    }
  }, [tagInput, allTags, tags])

  const handleTagInputChange = (value: string) => {
    setTagInput(value)
    if (value.includes(',')) {
      const newTags = value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag && !tags.includes(tag))
      if (newTags.length > 0) {
        setTags([...tags, ...newTags])
        setTagInput('')
        setShowTagsDropdown(false)
      }
    }
  }

  const handleSelectTag = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag])
      setTagInput('')
      setShowTagsDropdown(false)
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleSelectCategoryLarge = (value: string) => {
    setCategoryLarge(value)
    setCategoryMedium('')
    setCategorySmall('')
    setShowCategoryLargeDropdown(false)
    setSelectedCategoryLargeIndex(-1)
  }

  const handleSelectCategoryMedium = (value: string) => {
    setCategoryMedium(value)
    setCategorySmall('')
    setShowCategoryMediumDropdown(false)
    setSelectedCategoryMediumIndex(-1)
  }

  const handleSelectCategorySmall = (value: string) => {
    setCategorySmall(value)
    setShowCategorySmallDropdown(false)
    setSelectedCategorySmallIndex(-1)
  }

  const handleSelectNote = (note: Note) => {
    if (!relatedNoteIds.includes(note.id)) {
      setRelatedNoteIds([...relatedNoteIds, note.id])
      setRelatedNoteInput('')
      setShowNotesDropdown(false)
      setSelectedNoteIndex(-1)
    }
  }

  const handleRelatedNoteSearchSelect = (noteIds: string[]) => {
    // 이미 선택된 노트와 새로 선택한 노트를 합침 (중복 제거)
    const newNoteIds = Array.from(new Set([...relatedNoteIds, ...noteIds]))
    setRelatedNoteIds(newNoteIds)
    setRelatedNoteInput('')
  }

  // 키보드 네비게이션 핸들러
  const handleCategoryLargeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      // 필터링된 항목이 없으면 모든 항목을 표시
      const itemsToShow = filteredCategoryLarge.length > 0 ? filteredCategoryLarge : allCategoryLarge
      if (itemsToShow.length > 0) {
        if (!showCategoryLargeDropdown) {
          setShowCategoryLargeDropdown(true)
          // 필터링된 항목이 없으면 모든 항목을 필터링 목록에 추가
          if (filteredCategoryLarge.length === 0) {
            setFilteredCategoryLarge(allCategoryLarge)
          }
        }
        setSelectedCategoryLargeIndex((prev) => {
          const currentItems = filteredCategoryLarge.length > 0 ? filteredCategoryLarge : allCategoryLarge
          return prev < currentItems.length - 1 ? prev + 1 : 0
        })
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      const itemsToShow = filteredCategoryLarge.length > 0 ? filteredCategoryLarge : allCategoryLarge
      if (itemsToShow.length > 0) {
        if (!showCategoryLargeDropdown) {
          setShowCategoryLargeDropdown(true)
          if (filteredCategoryLarge.length === 0) {
            setFilteredCategoryLarge(allCategoryLarge)
          }
        }
        setSelectedCategoryLargeIndex((prev) => {
          const currentItems = filteredCategoryLarge.length > 0 ? filteredCategoryLarge : allCategoryLarge
          return prev > 0 ? prev - 1 : currentItems.length - 1
        })
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      const itemsToShow = filteredCategoryLarge.length > 0 ? filteredCategoryLarge : allCategoryLarge
      if (showCategoryLargeDropdown && itemsToShow.length > 0) {
        if (selectedCategoryLargeIndex >= 0 && selectedCategoryLargeIndex < itemsToShow.length) {
          handleSelectCategoryLarge(itemsToShow[selectedCategoryLargeIndex])
        } else if (itemsToShow.length > 0) {
          handleSelectCategoryLarge(itemsToShow[0])
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setShowCategoryLargeDropdown(false)
      setSelectedCategoryLargeIndex(-1)
    }
  }

  const handleCategoryMediumKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!categoryLarge) return
    
    const mediumOptions = existingNotes
      .filter((n) => n.category_large === categoryLarge && n.category_medium)
      .map((n) => n.category_medium!)
    const uniqueMedium = Array.from(new Set(mediumOptions)).sort()
    const itemsToShow = filteredCategoryMedium.length > 0 ? filteredCategoryMedium : uniqueMedium

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      if (itemsToShow.length > 0) {
        if (!showCategoryMediumDropdown) {
          setShowCategoryMediumDropdown(true)
          if (filteredCategoryMedium.length === 0) {
            setFilteredCategoryMedium(uniqueMedium)
          }
        }
        setSelectedCategoryMediumIndex((prev) => {
          const currentItems = filteredCategoryMedium.length > 0 ? filteredCategoryMedium : uniqueMedium
          return prev < currentItems.length - 1 ? prev + 1 : 0
        })
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      if (itemsToShow.length > 0) {
        if (!showCategoryMediumDropdown) {
          setShowCategoryMediumDropdown(true)
          if (filteredCategoryMedium.length === 0) {
            setFilteredCategoryMedium(uniqueMedium)
          }
        }
        setSelectedCategoryMediumIndex((prev) => {
          const currentItems = filteredCategoryMedium.length > 0 ? filteredCategoryMedium : uniqueMedium
          return prev > 0 ? prev - 1 : currentItems.length - 1
        })
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (showCategoryMediumDropdown && itemsToShow.length > 0) {
        if (selectedCategoryMediumIndex >= 0 && selectedCategoryMediumIndex < itemsToShow.length) {
          handleSelectCategoryMedium(itemsToShow[selectedCategoryMediumIndex])
        } else {
          handleSelectCategoryMedium(itemsToShow[0])
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setShowCategoryMediumDropdown(false)
      setSelectedCategoryMediumIndex(-1)
    }
  }

  const handleCategorySmallKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!categoryMedium) return
    
    const smallOptions = existingNotes
      .filter(
        (n) =>
          n.category_large === categoryLarge &&
          n.category_medium === categoryMedium &&
          n.category_small
      )
      .map((n) => n.category_small!)
    const uniqueSmall = Array.from(new Set(smallOptions)).sort()
    const itemsToShow = filteredCategorySmall.length > 0 ? filteredCategorySmall : uniqueSmall

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      if (itemsToShow.length > 0) {
        if (!showCategorySmallDropdown) {
          setShowCategorySmallDropdown(true)
          if (filteredCategorySmall.length === 0) {
            setFilteredCategorySmall(uniqueSmall)
          }
        }
        setSelectedCategorySmallIndex((prev) => {
          const currentItems = filteredCategorySmall.length > 0 ? filteredCategorySmall : uniqueSmall
          return prev < currentItems.length - 1 ? prev + 1 : 0
        })
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      if (itemsToShow.length > 0) {
        if (!showCategorySmallDropdown) {
          setShowCategorySmallDropdown(true)
          if (filteredCategorySmall.length === 0) {
            setFilteredCategorySmall(uniqueSmall)
          }
        }
        setSelectedCategorySmallIndex((prev) => {
          const currentItems = filteredCategorySmall.length > 0 ? filteredCategorySmall : uniqueSmall
          return prev > 0 ? prev - 1 : currentItems.length - 1
        })
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (showCategorySmallDropdown && itemsToShow.length > 0) {
        if (selectedCategorySmallIndex >= 0 && selectedCategorySmallIndex < itemsToShow.length) {
          handleSelectCategorySmall(itemsToShow[selectedCategorySmallIndex])
        } else {
          handleSelectCategorySmall(itemsToShow[0])
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setShowCategorySmallDropdown(false)
      setSelectedCategorySmallIndex(-1)
    }
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const itemsToShow = filteredTags.length > 0 ? filteredTags : allTags.filter(tag => !tags.includes(tag))

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      if (itemsToShow.length > 0) {
        if (!showTagsDropdown) {
          setShowTagsDropdown(true)
          if (filteredTags.length === 0) {
            setFilteredTags(itemsToShow)
          }
        }
        setSelectedTagIndex((prev) => {
          const currentItems = filteredTags.length > 0 ? filteredTags : itemsToShow
          return prev < currentItems.length - 1 ? prev + 1 : 0
        })
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      if (itemsToShow.length > 0) {
        if (!showTagsDropdown) {
          setShowTagsDropdown(true)
          if (filteredTags.length === 0) {
            setFilteredTags(itemsToShow)
          }
        }
        setSelectedTagIndex((prev) => {
          const currentItems = filteredTags.length > 0 ? filteredTags : itemsToShow
          return prev > 0 ? prev - 1 : currentItems.length - 1
        })
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (showTagsDropdown && itemsToShow.length > 0 && selectedTagIndex >= 0 && selectedTagIndex < itemsToShow.length) {
        handleSelectTag(itemsToShow[selectedTagIndex])
      } else {
        const trimmedTag = tagInput.trim()
        if (trimmedTag && !tags.includes(trimmedTag)) {
          setTags([...tags, trimmedTag])
          setTagInput('')
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setShowTagsDropdown(false)
      setSelectedTagIndex(-1)
    }
  }

  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const availableNotes = existingNotes.filter(note => !relatedNoteIds.includes(note.id))
    const itemsToShow = filteredNotes.length > 0 ? filteredNotes : availableNotes

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      if (itemsToShow.length > 0) {
        if (!showNotesDropdown) {
          setShowNotesDropdown(true)
          if (filteredNotes.length === 0) {
            setFilteredNotes(availableNotes)
          }
        }
        setSelectedNoteIndex((prev) => {
          const currentItems = filteredNotes.length > 0 ? filteredNotes : availableNotes
          return prev < currentItems.length - 1 ? prev + 1 : 0
        })
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      if (itemsToShow.length > 0) {
        if (!showNotesDropdown) {
          setShowNotesDropdown(true)
          if (filteredNotes.length === 0) {
            setFilteredNotes(availableNotes)
          }
        }
        setSelectedNoteIndex((prev) => {
          const currentItems = filteredNotes.length > 0 ? filteredNotes : availableNotes
          return prev > 0 ? prev - 1 : currentItems.length - 1
        })
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (showNotesDropdown && itemsToShow.length > 0) {
        if (selectedNoteIndex >= 0 && selectedNoteIndex < itemsToShow.length) {
          handleSelectNote(itemsToShow[selectedNoteIndex])
        } else {
          handleSelectNote(itemsToShow[0])
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setShowNotesDropdown(false)
      setSelectedNoteIndex(-1)
    }
  }

  const handleRemoveRelatedNote = (noteId: string) => {
    setRelatedNoteIds(relatedNoteIds.filter((id) => id !== noteId))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !title.trim()) return

    setSubmitting(true)

    if (!noteId) {
      const { data: profile } = await supabase
        .from('users')
        .select('plan, total_notes')
        .eq('id', user.id)
        .single()
      const limits = getLimitsForPlan(profile?.plan ?? null)
      const totalNotes = profile?.total_notes ?? 0
      if (totalNotes >= limits.maxNotes) {
        alert(`노트 한도를 초과했습니다. (${totalNotes}/${limits.maxNotes}) 플랜 업그레이드를 원하시면 플랜 페이지를 확인해 주세요.`)
        setSubmitting(false)
        return
      }
    }

    const noteData = {
      title: title.trim(),
      description: description.trim() || null,
      category_large: categoryLarge || null,
      category_medium: categoryMedium || null,
      category_small: categorySmall || null,
      tags: tags.length > 0 ? tags : null,
      related_note_ids: relatedNoteIds.length > 0 ? relatedNoteIds : null,
    }

    let data, error

    if (noteId) {
      // 수정 모드
      const result = await supabase
        .from('notes')
        .update(noteData)
        .eq('id', noteId)
        .select()
        .single()
      data = result.data
      error = result.error
    } else {
      // 생성 모드
      const result = await supabase
        .from('notes')
        .insert({
          ...noteData,
          user_id: user.id,
        })
        .select()
        .single()
      data = result.data
      error = result.error
    }

    if (error) {
      console.error(`Error ${noteId ? 'updating' : 'creating'} note:`, error)
      alert(`노트 ${noteId ? '수정' : '생성'}에 실패했습니다.`)
      setSubmitting(false)
      return
    }

    // 폼 리셋
    setTitle('')
    setDescription('')
    setCategoryLarge('')
    setCategoryMedium('')
    setCategorySmall('')
    setTags([])
    setTagInput('')
    setRelatedNoteIds([])
    setRelatedNoteInput('')

    setSubmitting(false)
    onClose()
    if (onSuccess) {
      onSuccess()
    }
  }

  const handleClose = () => {
    if (!submitting) {
      setTitle('')
      setDescription('')
      setCategoryLarge('')
      setCategoryMedium('')
      setCategorySmall('')
      setTags([])
      setTagInput('')
      setRelatedNoteIds([])
      setRelatedNoteInput('')
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !submitting && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{noteId ? '노트 수정' : '새 노트 생성'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-6">
            <div>
              <Label>
                제목 <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="노트 제목을 입력하세요"
                className="mt-2"
              />
            </div>

            <div>
              <Label>설명</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="노트에 대한 간단한 설명을 입력하세요"
                className="mt-2"
              />
            </div>

            {/* 카테고리 */}
            <div>
              <h3 className="mb-4 text-sm font-medium text-foreground">
                카테고리
              </h3>
              {/* 선택된 카테고리 표시 */}
              {(categoryLarge || categoryMedium || categorySmall) && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {categoryLarge && (
                    <>
                      <Badge variant="secondary">{categoryLarge}</Badge>
                      {categoryMedium && (
                        <>
                          <span className="text-muted-foreground">&gt;</span>
                          <Badge variant="secondary">{categoryMedium}</Badge>
                          {categorySmall && (
                            <>
                              <span className="text-muted-foreground">&gt;</span>
                              <Badge variant="secondary">{categorySmall}</Badge>
                            </>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
              <div className="flex items-end gap-2">
                {/* 대분류 */}
                <div ref={categoryLargeRef} className="relative flex-1">
                  <Label className="text-xs">대분류</Label>
                  <Input
                    type="text"
                    value={categoryLarge}
                    onChange={(e) => setCategoryLarge(e.target.value)}
                    onKeyDown={handleCategoryLargeKeyDown}
                    onFocus={() => {
                      if (allCategoryLarge.length > 0) {
                        if (categoryLarge) {
                          const filtered = allCategoryLarge.filter((cat) =>
                            cat.toLowerCase().includes(categoryLarge.toLowerCase())
                          )
                          if (filtered.length > 0) {
                            setFilteredCategoryLarge(filtered)
                            setShowCategoryLargeDropdown(true)
                          }
                        }
                      }
                    }}
                    placeholder="대분류 입력 또는 선택"
                    className="mt-1"
                  />
                  {showCategoryLargeDropdown && (() => {
                    const displayItems = filteredCategoryLarge.length > 0 ? filteredCategoryLarge : allCategoryLarge
                    return (
                      <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
                        {displayItems.map((option, index) => (
                          <button
                            key={option}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              handleSelectCategoryLarge(option)
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                              index === selectedCategoryLargeIndex && selectedCategoryLargeIndex >= 0 && selectedCategoryLargeIndex < displayItems.length
                                ? 'bg-[#1F2A44] text-white'
                                : 'text-popover-foreground'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )
                  })()}
                </div>

                {/* 중분류 */}
                {categoryLarge && (
                  <>
                    <span className="mb-5 text-muted-foreground">
                      &gt;
                    </span>
                    <div ref={categoryMediumRef} className="relative flex-1">
                      <Label className="text-xs">중분류</Label>
                      <Input
                        type="text"
                        value={categoryMedium}
                        onChange={(e) => setCategoryMedium(e.target.value)}
                        onKeyDown={handleCategoryMediumKeyDown}
                        onFocus={() => {
                          if (categoryMedium && filteredCategoryMedium.length > 0) {
                            setShowCategoryMediumDropdown(true)
                          }
                        }}
                        placeholder="중분류 입력 또는 선택"
                        className="mt-1"
                      />
                      {showCategoryMediumDropdown && (() => {
                        const mediumOptions = existingNotes
                          .filter((n) => n.category_large === categoryLarge && n.category_medium)
                          .map((n) => n.category_medium!)
                        const uniqueMedium = Array.from(new Set(mediumOptions)).sort()
                        const displayItems = filteredCategoryMedium.length > 0 ? filteredCategoryMedium : uniqueMedium
                        return (
                          <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
                            {displayItems.map((option, index) => (
                              <button
                                key={option}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  handleSelectCategoryMedium(option)
                                }}
                                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                                  index === selectedCategoryMediumIndex && selectedCategoryMediumIndex >= 0 && selectedCategoryMediumIndex < displayItems.length
                                    ? 'bg-[#1F2A44] text-white'
                                    : 'text-popover-foreground'
                                }`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  </>
                )}

                {/* 소분류 */}
                {categoryMedium && (
                  <>
                    <span className="mb-5 text-muted-foreground">
                      &gt;
                    </span>
                    <div ref={categorySmallRef} className="relative flex-1">
                      <Label className="text-xs">소분류</Label>
                      <Input
                        type="text"
                        value={categorySmall}
                        onChange={(e) => setCategorySmall(e.target.value)}
                        onKeyDown={handleCategorySmallKeyDown}
                        onFocus={() => {
                          if (categorySmall && filteredCategorySmall.length > 0) {
                            setShowCategorySmallDropdown(true)
                          }
                        }}
                        placeholder="소분류 입력 또는 선택"
                        className="mt-1"
                      />
                      {showCategorySmallDropdown && (() => {
                        const smallOptions = existingNotes
                          .filter(
                            (n) =>
                              n.category_large === categoryLarge &&
                              n.category_medium === categoryMedium &&
                              n.category_small
                          )
                          .map((n) => n.category_small!)
                        const uniqueSmall = Array.from(new Set(smallOptions)).sort()
                        const displayItems = filteredCategorySmall.length > 0 ? filteredCategorySmall : uniqueSmall
                        return (
                          <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
                            {displayItems.map((option, index) => (
                              <button
                                key={option}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  handleSelectCategorySmall(option)
                                }}
                                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                                  index === selectedCategorySmallIndex && selectedCategorySmallIndex >= 0 && selectedCategorySmallIndex < displayItems.length
                                    ? 'bg-[#1F2A44] text-white'
                                    : 'text-popover-foreground'
                                }`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 태그 */}
            <div ref={tagsRef} className="relative">
              <Label>태그</Label>
              <Input
                type="text"
                value={tagInput}
                onChange={(e) => handleTagInputChange(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onFocus={() => {
                  if (filteredTags.length > 0) {
                    setShowTagsDropdown(true)
                  }
                }}
                placeholder="태그를 콤마(,) 또는 Enter로 구분하여 입력하거나 자동완성에서 선택"
                className="mt-2"
              />
              {showTagsDropdown && (() => {
                const displayItems = filteredTags.length > 0 ? filteredTags : allTags.filter(tag => !tags.includes(tag))
                return (
                          <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
                    {displayItems.map((tag, index) => (
                      <button
                        key={tag}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleSelectTag(tag)
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                          index === selectedTagIndex && selectedTagIndex >= 0 && selectedTagIndex < displayItems.length
                            ? 'bg-[#1F2A44] text-white'
                            : 'text-popover-foreground'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )
              })()}
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="gap-1">
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:opacity-70"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* 연관 노트 */}
            <div ref={notesRef} className="relative">
              <div className="mb-2 flex items-center justify-between">
                <Label>연관 노트</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRelatedNoteSearchDialog(true)}
                >
                  검색
                </Button>
              </div>
              <Input
                type="text"
                value={relatedNoteInput}
                onChange={(e) => setRelatedNoteInput(e.target.value)}
                onKeyDown={handleNoteKeyDown}
                onFocus={() => {
                  if (filteredNotes.length > 0) {
                    setShowNotesDropdown(true)
                  }
                }}
                placeholder="노트 제목으로 검색"
                className="mt-2"
              />
              {showNotesDropdown && (() => {
                const availableNotes = existingNotes.filter(note => !relatedNoteIds.includes(note.id))
                const displayItems = filteredNotes.length > 0 ? filteredNotes : availableNotes
                return (
                          <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
                    {displayItems.map((note, index) => (
                      <button
                        key={note.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleSelectNote(note)
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${
                          index === selectedNoteIndex && selectedNoteIndex >= 0 && selectedNoteIndex < displayItems.length
                            ? 'bg-[#1F2A44] text-white'
                            : 'text-popover-foreground'
                        }`}
                      >
                        {note.title}
                      </button>
                    ))}
                  </div>
                )
              })()}
              {relatedNoteIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {relatedNoteIds.map((noteId) => {
                    const note = existingNotes.find((n) => n.id === noteId)
                    return (
                      <Badge key={noteId} variant="outline" className="gap-1">
                        {note?.title || noteId}
                        <button
                          type="button"
                          onClick={() => handleRemoveRelatedNote(noteId)}
                          className="ml-1 hover:opacity-70"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={submitting || !title.trim()}
            >
              {submitting
                ? noteId
                  ? '수정 중...'
                  : '생성 중...'
                : noteId
                  ? '노트 수정'
                  : '노트 생성'}
            </Button>
          </DialogFooter>
        </form>

        {/* 연관 노트 검색 다이얼로그 */}
        <RelatedNoteSearchDialog
          user={user}
          isOpen={showRelatedNoteSearchDialog}
          onClose={() => setShowRelatedNoteSearchDialog(false)}
          onSelect={handleRelatedNoteSearchSelect}
          excludeNoteIds={relatedNoteIds}
        />
      </DialogContent>
    </Dialog>
  )
}
